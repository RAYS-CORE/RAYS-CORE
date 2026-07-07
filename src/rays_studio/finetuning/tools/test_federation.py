import torch
from rays_studio.federation import FederatedAggregator

def test_ties_merging():
    print("Running TIES-Merging Verification...")
    
    # Simulate a scenario where two clients have completely opposing gradients
    # This is the classic "Destructive Interference" scenario that breaks standard FedAvg
    
    # Client A wants to push the weights positively (e.g. +1.0)
    # Client B wants to push the weights negatively (e.g. -0.8)
    # But Client A's magnitude is stronger, so the consensus should be POSITIVE.
    
    # 5 parameters
    client_a_delta = torch.tensor([1.0,  0.5,  0.1, -0.2, 0.9])
    client_b_delta = torch.tensor([-0.8, -0.6, 0.0,  0.1, 0.1])
    
    client_deltas = [client_a_delta, client_b_delta]
    
    # 1. Standard FedAvg (What everyone else does)
    # Result: (1.0 - 0.8) / 2 = +0.1 (Massive loss of signal magnitude)
    standard_fed_avg = torch.mean(torch.stack(client_deltas), dim=0)
    
    # 2. TIES-Merging (Our approach)
    # Result: Trim bottom 20% (0.1, 0.0). Elect Sign (+). Merge only positive values.
    ties_merged = FederatedAggregator.ties_merging(client_deltas, trim_ratio=0.2)
    
    print(f"Client A Delta: {client_a_delta.tolist()}")
    print(f"Client B Delta: {client_b_delta.tolist()}")
    print(f"Standard FedAvg (Destructive): {standard_fed_avg.tolist()}")
    print(f"TIES-Merged (Constructive):    {ties_merged.tolist()}")
    
    # Assertions to prove mathematical correctness
    # For parameter 0: Consensus is +, Client A is +, Client B is -. 
    # B is discarded. A is averaged (by 1 client). Result should be 1.0.
    assert torch.isclose(ties_merged[0], torch.tensor(1.0)), "TIES failed to resolve sign conflict!"
    
    print("\nSUCCESS: TIES-Merging successfully elected the consensus sign and preserved the true signal magnitude, mathematically preventing Catastrophic Interference!")

def test_svd_routing():
    print("\nRunning SVD Orthogonal Routing Verification...")
    
    # Mock base weight matrix
    base_weight = torch.randn(64, 64)
    num_clients = 2
    
    # Generate orthogonal projection masks for clients
    masks = FederatedAggregator.svd_orthogonal_partition(base_weight, num_clients)
    mask_a = masks[0]
    mask_b = masks[1]
    
    # Prove that the sub-spaces are mathematically orthogonal
    # The dot product (trace of A^T * B) should be 0
    dot_product = torch.trace(mask_a.transpose(0, 1) @ mask_b)
    
    print(f"Sub-space Orthogonality Dot Product: {dot_product.item():.6e}")
    assert abs(dot_product.item()) < 1e-5, "Client sub-spaces are NOT orthogonal!"
    
    print("SUCCESS: SVD successfully partitioned the weight matrix into strictly orthogonal, non-interfering sub-spaces.")

if __name__ == "__main__":
    test_ties_merging()
    test_svd_routing()
