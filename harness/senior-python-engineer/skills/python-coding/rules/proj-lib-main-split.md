# proj-lib-main-split

> Split library code from application entrypoints: `src/mypackage/` for library logic, top-level entrypoints or `cli.py` for application wiring.

## Why
Separating library code from application wiring enables reuse, independent testing, and packaging as both a library and an application.

## Bad
```
myproject/
├── main.py          # Everything in one file
└── utils.py
```

## Good
```
myproject/
├── src/
│   └── mypackage/
│       ├── __init__.py
│       ├── core.py
│       └── pipeline.py
├── cli.py           # Thin entrypoint
└── pyproject.toml
```
