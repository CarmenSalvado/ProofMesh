# ProofMesh JupyterLite Build

This folder contains the JupyterLite configuration and extensions for ProofMesh workspaces.

## Build (local)

```bash
pip install jupyterlite jupyterlite-pyodide-kernel
cd frontend/jupyterlite
jupyter lite build --config jupyter_lite_config.json
```

The build outputs to `frontend/public/jupyterlite`.

## Notes

- The ProofMesh bridge extension reads `?workspace=<id>&api=<base_url>` from the URL to connect to the backend contents API.
- Make sure `NEXT_PUBLIC_API_URL` is set when running the Next app so the iframe passes the correct API base.
