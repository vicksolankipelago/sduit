/**
 * VariablePanel Component
 *
 * Displays available template variables grouped by category.
 * Users can click variables to insert them into prompts.
 */

import React, { useState } from 'react';
import { Variable, VariableCategory, VARIABLE_CATEGORIES } from '../../types/variables';
import { getOrderedCategories } from '../../hooks/useVariables';
import './VariablePanel.css';

interface VariablePanelProps {
  /** All available variables */
  variables: Variable[];
  /** Variables grouped by category */
  variablesByCategory: Record<VariableCategory, Variable[]>;
  /** Callback when a variable is clicked to insert */
  onInsert: (variableName: string) => void;
  /** Optional: callback for adding custom variables */
  onAddCustom?: () => void;
  /** Display mode */
  mode?: 'default' | 'compact' | 'inline';
  /** Whether the panel is disabled */
  disabled?: boolean;
}

const VariablePanel: React.FC<VariablePanelProps> = ({
  variablesByCategory,
  onInsert,
  onAddCustom,
  mode = 'default',
  disabled = false,
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<VariableCategory>>(new Set());

  const toggleCategory = (category: VariableCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleVariableClick = (variableName: string) => {
    if (!disabled) {
      onInsert(variableName);
    }
  };

  const categories = getOrderedCategories();

  return (
    <div className={`variable-panel ${mode} ${disabled ? 'disabled' : ''}`}>
      <div className="variable-panel-header">
        <span className="variable-panel-header-icon">📋</span>
        <h3>Variables</h3>
      </div>

      {categories.map(category => {
        const categoryVars = variablesByCategory[category];
        const categoryInfo = VARIABLE_CATEGORIES[category];
        const isCollapsed = collapsedCategories.has(category);
        const isEmpty = categoryVars.length === 0;

        // Skip empty non-custom categories
        if (isEmpty && category !== 'custom') {
          return null;
        }

        return (
          <div key={category} className="variable-category">
            <div
              className="variable-category-header"
              onClick={() => toggleCategory(category)}
            >
              <span className="variable-category-icon">{categoryInfo.icon}</span>
              <span className="variable-category-label">{categoryInfo.label}</span>
              <span className={`variable-category-toggle ${isCollapsed ? 'collapsed' : ''}`}>
                ▼
              </span>
            </div>

            <div className={`variable-list ${isCollapsed ? 'collapsed' : ''}`}>
              {categoryVars.map(variable => (
                <div
                  key={variable.name}
                  className="variable-item"
                  onClick={() => handleVariableClick(variable.name)}
                  title={`Click to insert {{${variable.name}}}`}
                >
                  <span className="variable-item-name">{`{{${variable.name}}}`}</span>
                  <span className="variable-item-description">{variable.description}</span>
                </div>
              ))}

              {category === 'custom' && isEmpty && (
                <div className="variable-empty">No custom variables defined</div>
              )}

              {category === 'custom' && onAddCustom && (
                <button
                  className="variable-add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddCustom();
                  }}
                  disabled={disabled}
                  type="button"
                >
                  + Add Variable
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VariablePanel;
