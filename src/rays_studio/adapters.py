import torch
import torch.nn as nn
import torch.nn.functional as F

class OrthogonalLinear(nn.Module):
    """
    A Linear layer that enforces strictly orthogonal weight matrices
    using the Cayley parameterization to preserve L2 norm (hyperspherical energy).
    """
    def __init__(self, in_features, out_features):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        
        # We need a square matrix for Cayley parameterization, so we use max dimension
        self.dim = max(in_features, out_features)
        
        # A is the learnable parameter. We initialize it to a random normal distribution.
        # To make it skew-symmetric, we will do: S = A - A^T
        self.A = nn.Parameter(torch.randn(self.dim, self.dim) * 0.01)
        
    def get_orthogonal_weight(self):
        # 1. Create Skew-Symmetric matrix S
        S = self.A - self.A.transpose(0, 1)
        
        # 2. Cayley transform: R = (I - S) @ (I + S)^-1
        I = torch.eye(self.dim, device=self.A.device, dtype=self.A.dtype)
        R = torch.linalg.solve(I + S, I - S)
        
        # 3. Slice the orthogonal matrix to the exact dimensions needed
        # (in case in_features != out_features)
        weight = R[:self.out_features, :self.in_features]
        return weight

    def forward(self, x):
        weight = self.get_orthogonal_weight()
        return F.linear(x, weight)


class SpectrallyBoundedZeroGatedAdapter(nn.Module):
    """
    SB-ZGA: Spectrally-Bounded Zero-Gated Adapter.
    Injects an orthogonal bottleneck adapter into the residual stream.
    Bounded by a zero-initialized tanh gate to prevent catastrophic drift.
    """
    def __init__(self, hidden_dim, bottleneck_dim=32):
        super().__init__()
        self.hidden_dim = hidden_dim
        
        # The adapter is an orthogonal down-projection followed by an orthogonal up-projection
        self.down_proj = OrthogonalLinear(hidden_dim, bottleneck_dim)
        self.up_proj = OrthogonalLinear(bottleneck_dim, hidden_dim)
        
        self.activation = nn.SiLU() # Smooth activation
        
        # The zero-initialized scalar alpha
        # We use a Parameter initialized to exactly 0.0
        self.alpha = nn.Parameter(torch.zeros(1))
        
    def forward(self, x):
        # Pass through the orthogonal bottleneck
        h = self.down_proj(x)
        h = self.activation(h)
        h = self.up_proj(h)
        
        # The Bounded Gate: tanh(alpha) ensures the scalar never exceeds [-1, 1]
        gate = torch.tanh(self.alpha)
        
        # Identity addition: x + gate * adapter(x)
        # On Day 1, alpha=0, gate=0, so output exactly equals x.
        return x + gate * h
