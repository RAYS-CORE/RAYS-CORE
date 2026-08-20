from setuptools import find_packages, setup
from setuptools.command.install import install
from setuptools.command.develop import develop
import os
import shutil
from pathlib import Path

def _copy_skills():
    """Copy skills and extensions to ~/.rays during installation."""
    source_skills = Path(__file__).parent / "src" / "rays_core" / "skills"
    source_extensions = Path(__file__).parent / "extensions"
    target_rays_dir = Path.home() / ".rays"
    target_skills = target_rays_dir / "skills"
    target_extensions = target_rays_dir / "extensions"
    
    if source_skills.exists() and source_skills.is_dir():
        target_rays_dir.mkdir(parents=True, exist_ok=True)
        if target_skills.exists():
            shutil.rmtree(target_skills)
        shutil.copytree(source_skills, target_skills)
        print(f"Successfully copied skills to {target_skills}")

    if source_extensions.exists() and source_extensions.is_dir():
        target_rays_dir.mkdir(parents=True, exist_ok=True)
        if target_extensions.exists():
            shutil.rmtree(target_extensions)
        shutil.copytree(source_extensions, target_extensions)
        print(f"Successfully copied extensions to {target_extensions}")
        
    # Clean up obsolete deckforge entry in mcp.json if present
    mcp_json_path = target_rays_dir / "mcp.json"
    if mcp_json_path.exists():
        import json
        try:
            with open(mcp_json_path, "r") as f:
                content = f.read().strip()
                if content:
                    mcp_data = json.loads(content)
                    if isinstance(mcp_data, list):
                        mcp_data = {"mcp_servers": mcp_data}
                    servers = mcp_data.get("mcp_servers", [])
                    filtered = [s for s in servers if s.get("name") != "rays_deckforge"]
                    if len(filtered) != len(servers):
                        mcp_data["mcp_servers"] = filtered
                        with open(mcp_json_path, "w") as wf:
                            json.dump(mcp_data, wf, indent=2)
        except Exception:
            pass

class PostInstallCommand(install):
    """Post-installation for installation mode."""
    def run(self):
        install.run(self)
        _copy_skills()

class PostDevelopCommand(develop):
    """Post-installation for development mode."""
    def run(self):
        develop.run(self)
        _copy_skills()

setup(
    name="rays-core",
    version="1.7.2",
    description="RAYS-CORE — AI-Powered Development Assistant",
    author="Samreedh Bhuyan",
    url="https://github.com/markknoffler/RAYS-CORE-CLI",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    package_data={"rays_core": ["config.yaml"]},
    install_requires=[
        "chromadb>=0.4,<1",
        "msgpack>=1.0,<2",
        "pyyaml>=6.0,<7",
        "requests>=2.28,<3",
        "rich>=13,<14",
        "tree-sitter>=0.21,<1",
        "mcp>=1.2,<2",
        "posthog>=2.4,<6",
        "torch>=2.0.0",
        "transformers>=4.40.0",
        "huggingface_hub>=0.23.0",
        "peft>=0.10.0",
        "fastapi>=0.100.0",
        "uvicorn>=0.23.0",
        "accelerate>=0.29.0",
    ],
    entry_points={
        "console_scripts": [
            "rays=rays_core.rays_main:main",
        ],
    },
    cmdclass={
        'install': PostInstallCommand,
        'develop': PostDevelopCommand,
    },
    python_requires=">=3.10",
)
