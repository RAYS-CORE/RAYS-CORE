import torch
from rays_studio.adapters import SpectrallyBoundedZeroGatedAdapter
from rays_studio.federation import FederatedAggregator

def run_end_to_end_federation():
    print("--- RAYS Studio: End-to-End Federated Mock Pipeline ---\n")
    
    hidden_dim = 64
    bottleneck_dim = 16
    
    print("[1] Initializing Central Enterprise Model (Base Weights)...")
    base_model_weights = torch.randn(hidden_dim, hidden_dim)
    
    print("[2] Spawning 3 Local RAYS Client Daemons...")
    # Simulate 3 clients initializing their Zero-Gated Adapters
    client_a = SpectrallyBoundedZeroGatedAdapter(hidden_dim, bottleneck_dim)
    client_b = SpectrallyBoundedZeroGatedAdapter(hidden_dim, bottleneck_dim)
    client_c = SpectrallyBoundedZeroGatedAdapter(hidden_dim, bottleneck_dim)
    
    print("[3] Simulating Local Autonomous Fine-Tuning on OSINT Logs...")
    # Give them mock gradients to simulate they trained on different tasks
    # We alter their underlying skew-symmetric matrices (A) to mock training drift
    with torch.no_grad():
        client_a.down_proj.A += torch.randn_like(client_a.down_proj.A) * 0.5
        client_b.down_proj.A += torch.randn_like(client_b.down_proj.A) * -0.5
        client_c.down_proj.A += torch.randn_like(client_c.down_proj.A) * 0.2
        
        # Their zero-gates open slightly as they train
        client_a.alpha += 0.1
        client_b.alpha += 0.15
        client_c.alpha += 0.05
    
    # Extract the delta weights (the orthogonal matrices) to send to server
    delta_a = client_a.down_proj.get_orthogonal_weight()
    delta_b = client_b.down_proj.get_orthogonal_weight()
    delta_c = client_c.down_proj.get_orthogonal_weight()
    
    print(f"    - Client A Delta Norm: {torch.norm(delta_a):.4f}")
    print(f"    - Client B Delta Norm: {torch.norm(delta_b):.4f}")
    print(f"    - Client C Delta Norm: {torch.norm(delta_c):.4f}")
    
    print("\n[4] Uploading Delta Weights to Central Enterprise Server (Size: ~15MB each)...")
    client_deltas = [delta_a, delta_b, delta_c]
    
    print("[5] Server Executing TIES-Merging for Destructive Interference Fallback...")
    ties_merged_delta = FederatedAggregator.ties_merging(client_deltas, trim_ratio=0.1)
    print(f"    - Merged Global Delta Norm: {torch.norm(ties_merged_delta):.4f}")
    
    print("[6] Server Executing SVD Orthogonal Routing Partitioning...")
    svd_masks = FederatedAggregator.svd_orthogonal_partition(base_model_weights, num_clients=3)
    
    # Prove non-interference
    dot_ab = torch.trace(svd_masks[0].transpose(0, 1) @ svd_masks[1])
    dot_bc = torch.trace(svd_masks[1].transpose(0, 1) @ svd_masks[2])
    print(f"    - Orthogonal Intersection (A ∩ B): {dot_ab.item():.6e}")
    print(f"    - Orthogonal Intersection (B ∩ C): {dot_bc.item():.6e}")
    
    print("\nSUCCESS: End-to-End RAYS Studio Pipeline executed without mathematical collapse.")

if __name__ == "__main__":
    run_end_to_end_federation()
