import torch

class FederatedAggregator:
    """
    Handles the server-side aggregation of client adapters.
    """
    
    @staticmethod
    def svd_orthogonal_partition(base_weight, num_clients):
        """
        Partitions a weight matrix into orthogonal sub-spaces using SVD.
        Each client gets a mask projecting gradients into their unique sub-space.
        """
        # 1. SVD Decomposition: W = U * S * V^T
        U, S, V = torch.linalg.svd(base_weight, full_matrices=False)
        
        # 2. Partition the basis vectors in U across clients
        # For simplicity, we assign an equal chunk of the left singular vectors to each client
        total_basis = U.shape[1]
        chunk_size = total_basis // num_clients
        
        client_masks = []
        for i in range(num_clients):
            # Create a projection matrix for this specific client's sub-space
            start_idx = i * chunk_size
            end_idx = start_idx + chunk_size if i != num_clients - 1 else total_basis
            
            # Select the client's basis vectors
            U_client = U[:, start_idx:end_idx]
            
            # Projection Matrix P = U_c * U_c^T
            # Any gradient multiplied by this matrix is forced into the client's sub-space
            P = U_client @ U_client.transpose(0, 1)
            client_masks.append(P)
            
        return client_masks
    
    @staticmethod
    def ties_merging(client_deltas, trim_ratio=0.2):
        """
        TIES-Merging: TrIm, Elect Sign, and Merge.
        Used for non-orthogonal fallback when clients update the same parameters.
        client_deltas: list of tensors representing delta weights from clients.
        """
        # Stack deltas for vectorized operations: shape (num_clients, *weight_shape)
        stacked_deltas = torch.stack(client_deltas)
        
        # 1. Trim: Remove the bottom `trim_ratio` of updates by magnitude
        # We calculate the threshold per client
        merged_shape = client_deltas[0].shape
        flat_deltas = stacked_deltas.view(len(client_deltas), -1)
        
        # Find the threshold value for trimming
        k = int(flat_deltas.shape[1] * (1.0 - trim_ratio))
        if k == 0:
            k = 1 # Keep at least 1 parameter
            
        topk_vals, _ = torch.topk(torch.abs(flat_deltas), k, dim=1)
        thresholds = topk_vals[:, -1].unsqueeze(1)
        
        # Create mask for trimmed values
        trim_mask = torch.abs(flat_deltas) >= thresholds
        trimmed_deltas = flat_deltas * trim_mask
        
        # 2. Elect Sign: Calculate the consensus sign across all clients
        # Sum the trimmed deltas to see which direction has the most momentum
        summed_deltas = torch.sum(trimmed_deltas, dim=0)
        consensus_sign = torch.sign(summed_deltas)
        
        # 3. Disjoint Merge: Average only the deltas that agree with the consensus sign
        client_signs = torch.sign(trimmed_deltas)
        sign_match_mask = (client_signs == consensus_sign.unsqueeze(0))
        
        # Zero out conflicting updates
        aligned_deltas = trimmed_deltas * sign_match_mask
        
        # Average the aligned updates (ignoring zeros)
        # Count how many clients contributed to each parameter
        contribution_counts = torch.sum(sign_match_mask, dim=0).float()
        contribution_counts = torch.clamp(contribution_counts, min=1.0)
        
        final_delta = torch.sum(aligned_deltas, dim=0) / contribution_counts
        
        return final_delta.view(merged_shape)
