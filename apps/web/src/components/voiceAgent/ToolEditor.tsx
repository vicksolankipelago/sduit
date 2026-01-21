import React, { useState } from 'react';
import { Tool, DEFAULT_TOOL_PARAMETERS } from '../../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { ToolIcon, TrashIcon } from '../Icons';
import './ToolEditor.css';

interface ToolEditorProps {
  tools: Tool[];
  onChange: (tools: Tool[]) => void;
  disabled?: boolean;
}

const ToolEditor: React.FC<ToolEditorProps> = ({
  tools,
  onChange,
  disabled = false,
}) => {
  const [selectedToolId, setSelectedToolId] = useState<string | null>(
    tools.length > 0 ? tools[0].id : null
  );

  const selectedTool = tools.find(t => t.id === selectedToolId);

  const handleAddTool = () => {
    const newTool: Tool = {
      id: uuidv4(),
      name: 'new_tool',
      description: 'Describe what this tool does',
      parameters: { ...DEFAULT_TOOL_PARAMETERS },
      uiComponent: '',
      executeCode: '// Tool execution logic\nreturn `Tool executed successfully`;',
    };
    
    onChange([...tools, newTool]);
    setSelectedToolId(newTool.id);
  };

  const handleDeleteTool = (toolId: string) => {
    if (window.confirm('Delete this tool?')) {
      onChange(tools.filter(t => t.id !== toolId));
      if (selectedToolId === toolId) {
        setSelectedToolId(tools.length > 1 ? tools[0].id : null);
      }
    }
  };

  const handleUpdateTool = (toolId: string, updates: Partial<Tool>) => {
    onChange(tools.map(t => t.id === toolId ? { ...t, ...updates } : t));
  };

  const handleUpdateParameters = (toolId: string, parametersJson: string) => {
    try {
      const parameters = JSON.parse(parametersJson);
      handleUpdateTool(toolId, { parameters });
    } catch (error) {
      console.error('Invalid JSON:', error);
    }
  };

  return (
    <div className={`tool-editor ${disabled ? 'disabled' : ''}`}>
      <div className="tool-editor-header">
        <h4><ToolIcon size={16} /> Tools</h4>
        <button
          className="tool-add-btn"
          onClick={handleAddTool}
          disabled={disabled}
          type="button"
        >
          + Add Tool
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="tool-empty-state">
          <p>No tools defined. Tools allow agents to perform actions and log data.</p>
          <button
            className="tool-add-empty-btn"
            onClick={handleAddTool}
            disabled={disabled}
            type="button"
          >
            Create First Tool
          </button>
        </div>
      ) : (
        <div className="tool-editor-layout">
          {/* Tool List */}
          <div className="tool-list">
            {tools.map(tool => (
              <div
                key={tool.id}
                className={`tool-item ${selectedToolId === tool.id ? 'active' : ''}`}
                onClick={() => setSelectedToolId(tool.id)}
              >
                <div className="tool-item-name">{tool.name}</div>
                <button
                  className="tool-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTool(tool.id);
                  }}
                  disabled={disabled}
                  type="button"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Tool Details */}
          {selectedTool && (
            <div className="tool-details">
              <div className="tool-field">
                <label>Tool Name</label>
                <input
                  type="text"
                  value={selectedTool.name}
                  onChange={(e) => handleUpdateTool(selectedTool.id, { name: e.target.value })}
                  placeholder="tool_name"
                  disabled={disabled}
                />
                <span className="tool-field-hint">Use snake_case (e.g., log_substance)</span>
              </div>

              <div className="tool-field">
                <label>Description</label>
                <textarea
                  value={selectedTool.description}
                  onChange={(e) => handleUpdateTool(selectedTool.id, { description: e.target.value })}
                  placeholder="Describe what this tool does..."
                  disabled={disabled}
                  rows={2}
                />
              </div>

              <div className="tool-field">
                <label>Parameters (JSON Schema)</label>
                <textarea
                  value={JSON.stringify(selectedTool.parameters, null, 2)}
                  onChange={(e) => handleUpdateParameters(selectedTool.id, e.target.value)}
                  placeholder='{"type": "object", "properties": {}}'
                  disabled={disabled}
                  rows={8}
                  className="tool-json-editor"
                />
                <span className="tool-field-hint">Define parameter schema in JSON format</span>
              </div>

              <div className="tool-field">
                <label>UI Component (Optional)</label>
                <input
                  type="text"
                  value={selectedTool.uiComponent || ''}
                  onChange={(e) => handleUpdateTool(selectedTool.id, { uiComponent: e.target.value })}
                  placeholder="e.g., SubstanceSelectionCard"
                  disabled={disabled}
                />
                <span className="tool-field-hint">Reference to registered UI component</span>
              </div>

              <div className="tool-field">
                <label>Execute Function (JavaScript)</label>
                <textarea
                  value={selectedTool.executeCode || ''}
                  onChange={(e) => handleUpdateTool(selectedTool.id, { executeCode: e.target.value })}
                  placeholder="// Return value that agent will see\nreturn `Action completed`;"
                  disabled={disabled}
                  rows={6}
                  className="tool-code-editor"
                />
                <span className="tool-field-hint">JavaScript function body (async supported)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolEditor;

