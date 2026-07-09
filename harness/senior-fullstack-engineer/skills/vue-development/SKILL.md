---
name: vue-development
description: "Vue 3 development: Composition API, script setup, Pinia, Vue Router, composables, provide/inject, defineModel, async components. Use for Vue component and app development."
compatibility: opencode
metadata:
  domain: vue
  audience: senior-engineer
---

# Vue Development

Guide for building production-grade Vue 3 applications with Composition API and `<script setup>`.

## When to apply

- Writing Vue 3 components with Composition API.
- Reviewing Vue code for patterns and performance.
- Implementing Pinia stores or Vue Router.
- Building Nuxt applications.

## Core principles

### 1. Composition API with `<script setup>`

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), { count: 0 });
const emit = defineEmits<{ update: [value: number] }>();

const localCount = ref(props.count);
const doubled = computed(() => localCount.value * 2);

function increment() {
  localCount.value++;
  emit('update', localCount.value);
}

onMounted(() => {
  console.log('Mounted');
});
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <p>Count: {{ localCount }} (doubled: {{ doubled }})</p>
    <button @click="increment">+1</button>
  </div>
</template>
```

### 2. `defineModel` (Vue 3.4+)

```vue
<script setup lang="ts">
const modelValue = defineModel<string>({ required: true });
</script>

<template>
  <input v-model="modelValue" />
</template>
```

Usage: `<MyInput v-model="name" />`

### 3. Composables

Composables encapsulate reusable reactive logic:

```typescript
// composables/useCounter.ts
import { ref, computed } from 'vue';

export function useCounter(initial = 0) {
  const count = ref(initial);
  const doubled = computed(() => count.value * 2);
  function increment() { count.value++; }
  function decrement() { count.value--; }
  return { count, doubled, increment, decrement };
}
```

Rules for composables:
- Prefix with `use`.
- Return reactive refs, not raw values.
- Avoid side effects in setup. Use `onMounted` for DOM access.
- Prefer composables over mixins (no namespace collisions).

### 4. Pinia stores

```typescript
// stores/user.ts
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => !!user.value);

  async function login(email: string, password: string) {
    user.value = await api.login(email, password);
  }

  function logout() {
    user.value = null;
  }

  return { user, isLoggedIn, login, logout };
});
```

### 5. Vue Router

```typescript
// router/index.ts
const routes = [
  {
    path: '/users/:id',
    component: () => import('@/pages/UserDetail.vue'), // lazy loaded
    beforeEnter: (to) => { /* guard */ },
  },
];
```

### 6. provide/inject

```typescript
// Parent
provide('theme', ref('dark'));

// Child
const theme = inject<Ref<string>>('theme');
```

Use for dependency injection, not as primary state management.

### 7. Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Options API in new code | Composition API with `<script setup>` |
| Mutating props | `defineModel` or emit events |
| Direct DOM manipulation | `ref` + `v-model` / `:class` / `:style` |
| Giant components | Extract composables and child components |
| `watch` for computed values | Use `computed` instead |
