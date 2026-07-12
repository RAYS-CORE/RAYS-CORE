from setuptools import find_packages, setup

setup(
    name="rays-core",
    version="1.7.0",
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
    python_requires=">=3.10",
)
