# name-verbs-for-methods

> Use verbs for method names; nouns for properties and attributes.

## Why
Methods do things; properties are things. Mixing them creates confusion about whether an accessor has side effects.

## Bad
```python
class User:
    def status(self) -> str:  # Should be property
        return self._status

    def order_summary(self) -> dict:  # Does I/O — should be verb
        return fetch_from_db(self.id)
```

## Good
```python
class User:
    @property
    def status(self) -> str:
        return self._status

    def fetch_order_summary(self) -> dict:
        return fetch_from_db(self.id)
```
