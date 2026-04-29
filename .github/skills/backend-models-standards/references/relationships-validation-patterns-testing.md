# Relationships, Validation, Patterns, and Testing

## Relationships — Explicit Configuration

**Define both sides of relationships:**

```python
# One-to-many
class User(Base):
    orders = relationship('Order', back_populates='user', cascade='all, delete-orphan')

class Order(Base):
    user_id = Column(Integer, ForeignKey('users.id'))
    user = relationship('User', back_populates='orders')
```

**Cascade behaviors:**
- `CASCADE`: Delete related records (user deleted → orders deleted)
- `SET NULL`: Nullify foreign key (category deleted → product.category_id = NULL)
- `RESTRICT`: Prevent deletion if related records exist
- `NO ACTION`: Database default, usually same as RESTRICT

**Choose based on business logic, not convenience.**

## Validation — Two Layers

**Model-level validation (application):**
```python
@validates('email')
def validate_email(self, key, email):
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise ValueError('Invalid email format')
    return email
```

**Database-level constraints (see Data Integrity section in SKILL.md)**

**Why both:** Model validation provides clear error messages. Database constraints prevent data corruption if application bypassed.

## Common Patterns

**Soft deletes:**
```python
deleted_at = Column(DateTime, nullable=True, index=True)

# Query only active records
query = session.query(User).filter(User.deleted_at.is_(None))
```

**Polymorphic associations:**
```python
# Avoid if possible - complex and hard to maintain
# Prefer separate relationship fields or inheritance
```

**Enums for fixed values:**
```python
from enum import Enum

class OrderStatus(str, Enum):
    PENDING = 'pending'
    PAID = 'paid'
    SHIPPED = 'shipped'
    DELIVERED = 'delivered'

status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.PENDING)
```

## Testing Models

**Test constraints and validation:**
```python
def test_user_email_required():
    with pytest.raises(IntegrityError):
        user = User(name='Test')
        session.add(user)
        session.commit()

def test_user_email_unique():
    user1 = User(email='test@example.com')
    user2 = User(email='test@example.com')
    session.add(user1)
    session.commit()
    
    with pytest.raises(IntegrityError):
        session.add(user2)
        session.commit()
```

**Test relationships:**
```python
def test_user_orders_cascade_delete():
    user = User(email='test@example.com')
    order = Order(user=user)
    session.add(user)
    session.commit()
    
    session.delete(user)
    session.commit()
    
    assert session.query(Order).count() == 0
```
