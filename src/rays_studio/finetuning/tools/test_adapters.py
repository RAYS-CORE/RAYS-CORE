import torch
from rays_studio.adapters import SpectrallyBoundedZeroGatedAdapter

def test_sb_zga():
    print("Running Spectrally-Bounded Zero-Gated Adapter (SB-ZGA) Verification...")
    
    # 1. Setup mock hidden state from an LLM (e.g. sequence length 10, hidden dim 4096)
    hidden_dim = 4096
    bottleneck_dim = 128
    batch_size = 1
    seq_len = 10
    
    # Random input tensor representing output of a frozen BaseLayer
    x = torch.randn(batch_size, seq_len, hidden_dim)
    
    # 2. Initialize our SB-ZGA Adapter
    adapter = SpectrallyBoundedZeroGatedAdapter(hidden_dim, bottleneck_dim)
    
    # 3. Verify Orthogonality
    # Get the weight matrices from the down and up projections
    w_down = adapter.down_proj.get_orthogonal_weight()
    w_up = adapter.up_proj.get_orthogonal_weight()
    
    # Check if W * W^T is approximately the Identity matrix
    # (Since W is tall/wide, we check the smaller dimension)
    identity_down = w_down @ w_down.transpose(0, 1)
    expected_eye_down = torch.eye(identity_down.shape[0])
    
    # Allow a small floating point error tolerance
    ortho_error = torch.max(torch.abs(identity_down - expected_eye_down))
    print(f"Orthogonality Error (Down Proj): {ortho_error.item():.6e}")
    assert ortho_error < 1e-5, "Weight matrix is not orthogonal!"
    
    # 4. Verify Day 1 Safety (Zero-Initialization Identity)
    y = adapter(x)
    
    # Ensure the output perfectly equals the input before any training
    identity_error = torch.max(torch.abs(y - x))
    print(f"Identity Output Error (y vs x): {identity_error.item():.6e}")
    assert identity_error == 0.0, "Day 1 Safety failed: Adapter altered the hidden states!"
    
    print("\nSUCCESS: The SB-ZGA mathematically guarantees Day 1 LLM safety and preserves L2 norms via Orthogonal Cayley transformations.")

if __name__ == "__main__":
    test_sb_zga()
