# Quickstart: Prompt Variable System

**Feature**: 001-prompt-variables
**Date**: 2025-01-19

## Overview

This feature adds template variable support to the prompt editors in Journey Builder. Variables like `{{memberName}}` are shown in a panel, autocompleted as you type, and validated before save.

## Key Files

| File | Purpose |
|------|---------|
| `components/voiceAgent/VariablePanel.tsx` | Sidebar showing available variables |
| `components/voiceAgent/VariableAutocomplete.tsx` | Dropdown for `{{` autocomplete |
| `components/voiceAgent/PromptTextarea.tsx` | Textarea with syntax highlighting |
| `hooks/useVariableAutocomplete.ts` | Autocomplete state management |
| `utils/promptTemplates.ts` | Variable definitions and validation |
| `types/variables.ts` | TypeScript interfaces |

## Usage Examples

### 1. Basic: Show Variable Panel

```tsx
import { VariablePanel } from './VariablePanel';
import { DEFAULT_VARIABLES } from '../../utils/promptTemplates';

function MyEditor() {
  const handleInsert = (varName: string) => {
    // Insert {{varName}} at cursor
  };

  return (
    <div className="editor-layout">
      <textarea />
      <VariablePanel
        variables={DEFAULT_VARIABLES}
        onInsert={handleInsert}
      />
    </div>
  );
}
```

### 2. Enhanced: Full Prompt Textarea

```tsx
import { PromptTextarea } from './PromptTextarea';
import { useVariables } from '../../hooks/useVariables';

function EnhancedEditor({ journey, value, onChange }) {
  const { variables } = useVariables(journey);

  return (
    <PromptTextarea
      value={value}
      onChange={onChange}
      variables={variables}
      placeholder="Enter your prompt..."
    />
  );
}
```

### 3. Validation

```tsx
import { validatePromptVariables } from '../../utils/promptTemplates';

function SaveButton({ prompt, variables, onSave }) {
  const handleSave = () => {
    const result = validatePromptVariables(prompt, variables);

    if (!result.isValid) {
      const invalid = result.variables.filter(v => !v.isValid);
      alert(`Invalid variables: ${invalid.map(v => v.name).join(', ')}`);
      return;
    }

    onSave();
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### 4. Custom Variables

```tsx
function CustomVariableEditor({ journey, onChange }) {
  const addVariable = () => {
    const newVar = {
      name: 'customField',
      description: 'A custom variable',
      category: 'custom',
      defaultValue: '',
      isCustom: true,
    };

    onChange({
      ...journey,
      customVariables: [...(journey.customVariables || []), newVar],
    });
  };

  return (
    <div>
      <h3>Custom Variables</h3>
      {journey.customVariables?.map(v => (
        <div key={v.name}>{v.name}: {v.description}</div>
      ))}
      <button onClick={addVariable}>+ Add Variable</button>
    </div>
  );
}
```

## Styling

Variables are highlighted using CSS classes:

```css
/* Valid variable */
.variable-highlight {
  background-color: rgba(29, 185, 84, 0.2);
  color: #1DB954;
  border-radius: 3px;
  padding: 0 2px;
}

/* Invalid variable */
.variable-highlight.invalid {
  background-color: rgba(255, 82, 82, 0.2);
  color: #FF5252;
  text-decoration: wavy underline;
}

/* Autocomplete dropdown */
.variable-autocomplete {
  position: absolute;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
}
```

## Testing

```typescript
// Unit test for validation
describe('validatePromptVariables', () => {
  it('should detect valid variables', () => {
    const result = validatePromptVariables(
      'Hello {{memberName}}',
      DEFAULT_VARIABLES
    );
    expect(result.isValid).toBe(true);
  });

  it('should detect invalid variables', () => {
    const result = validatePromptVariables(
      'Hello {{unknownVar}}',
      DEFAULT_VARIABLES
    );
    expect(result.isValid).toBe(false);
    expect(result.variables[0].error).toBe('Unknown variable');
  });
});
```
