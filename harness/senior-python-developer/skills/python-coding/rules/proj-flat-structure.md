# proj-flat-structure

> Prefer flat package structures with feature-based grouping over deep nesting.

## Why
Deep nesting (`mypackage.core.utils.helpers.transformers.base`) makes imports verbose, discovery difficult, and refactoring expensive. Flat or shallow structures with feature-based grouping improve readability and maintainability.

## Bad
```
mypackage/
├── core/
│   └── services/
│       └── user/
│           └── authentication/
│               └── oauth.py
```

## Good
```
mypackage/
├── auth/
│   ├── __init__.py
│   └── oauth.py
├── users/
│   ├── __init__.py
│   └── service.py
└── data/
    ├── __init__.py
    └── pipeline.py
```

## Exceptions
- Large monorepos with 50+ top-level modules may benefit from one extra grouping level.
- Domain-Driven Design bounded contexts may warrant a second nesting level.
