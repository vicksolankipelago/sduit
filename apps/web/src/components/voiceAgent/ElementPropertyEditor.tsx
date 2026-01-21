import React from 'react';
import { ElementConfig, AnyCodable } from '../../types/journey';
import { AVAILABLE_ANIMATIONS } from '../../utils/animationsList';
import './ElementPropertyEditor.css';

// Type-safe style accessor helper
type ElementStyleValue = string | number | boolean | null | undefined;

interface ElementStyleAccessor {
  style?: ElementStyleValue;
  size?: ElementStyleValue;
  alignment?: ElementStyleValue;
  color?: ElementStyleValue;
  imageName?: ElementStyleValue;
  imageWidth?: ElementStyleValue;
  imageHeight?: ElementStyleValue;
  backgroundColor?: ElementStyleValue;
  cornerRadius?: ElementStyleValue;
  icon?: ElementStyleValue;
  borderColor?: ElementStyleValue;
  height?: ElementStyleValue;
  direction?: ElementStyleValue;
  textColor?: ElementStyleValue;
  borderDashed?: ElementStyleValue;
  showAlert?: ElementStyleValue;
  width?: ElementStyleValue;
  contentMode?: ElementStyleValue;
  imageDimension?: ElementStyleValue;
  recolor?: ElementStyleValue;
  duration?: ElementStyleValue;
  loop?: ElementStyleValue;
  autoStart?: ElementStyleValue;
  curve?: ElementStyleValue;
}

// Helper function to safely access style properties
function getStyleValue<T extends ElementStyleValue>(
  style: Record<string, AnyCodable> | undefined,
  key: keyof ElementStyleAccessor,
  defaultValue: T
): T {
  if (!style) return defaultValue;
  const value = style[key];
  return (value as T) ?? defaultValue;
}

export interface ElementPropertyEditorProps {
  element: ElementConfig;
  onChange: (updates: Partial<ElementConfig>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const ElementPropertyEditor: React.FC<ElementPropertyEditorProps> = ({
  element,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
}) => {
  const handleDataChange = (key: string, value: AnyCodable) => {
    onChange({
      state: {
        ...element.state,
        [key]: value,
      },
    });
  };

  const handleStyleChange = (key: string, value: AnyCodable) => {
    onChange({
      style: {
        ...element.style,
        [key]: value,
      },
    });
  };

  // Render form fields based on element type
  const renderDataFields = () => {
    switch (element.type) {
      case 'button':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Button text"
              />
            </FormField>
            <FormField label="Disabled">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={element.state.isDisabled as boolean || false}
                  onChange={(e) => handleDataChange('isDisabled', e.target.checked)}
                />
                <span>Disable button</span>
              </label>
            </FormField>
          </>
        );

      case 'textBlock':
        return (
          <FormField label="Text" required>
            <textarea
              value={element.state.text as string || ''}
              onChange={(e) => handleDataChange('text', e.target.value)}
              placeholder="Enter text content"
              rows={4}
            />
          </FormField>
        );

      case 'imageCard':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Card title"
              />
            </FormField>
            <FormField label="Description" required>
              <textarea
                value={element.state.description as string || ''}
                onChange={(e) => handleDataChange('description', e.target.value)}
                placeholder="Card description"
                rows={3}
              />
            </FormField>
          </>
        );

      case 'checklistCard':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Checklist title"
              />
            </FormField>
            <FormField label="Items" required>
              <textarea
                value={(element.state.itemTitles as string[] || []).join('\n')}
                onChange={(e) => handleDataChange('itemTitles', e.target.value.split('\n').filter(Boolean))}
                placeholder="One item per line"
                rows={5}
              />
            </FormField>
          </>
        );

      case 'toggleCard':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Toggle title"
              />
            </FormField>
            <FormField label="Description">
              <input
                type="text"
                value={element.state.description as string || ''}
                onChange={(e) => handleDataChange('description', e.target.value)}
                placeholder="Optional description"
              />
            </FormField>
            <FormField label="Label">
              <input
                type="text"
                value={element.state.label as string || ''}
                onChange={(e) => handleDataChange('label', e.target.value)}
                placeholder="e.g., Recommended"
              />
            </FormField>
            <FormField label="Initially Toggled">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={element.state.isToggled as boolean || false}
                  onChange={(e) => handleDataChange('isToggled', e.target.checked)}
                />
                <span>Toggle on by default</span>
              </label>
            </FormField>
          </>
        );

      case 'quoteCard':
        return (
          <>
            <FormField label="Message" required>
              <textarea
                value={element.state.message as string || ''}
                onChange={(e) => handleDataChange('message', e.target.value)}
                placeholder="Quote text"
                rows={4}
              />
            </FormField>
            <FormField label="Job Title / Author">
              <input
                type="text"
                value={element.state.jobTitle as string || ''}
                onChange={(e) => handleDataChange('jobTitle', e.target.value)}
                placeholder="e.g., Dr. Smith, Care Team Lead"
              />
            </FormField>
          </>
        );

      case 'largeQuestion':
        return (
          <>
            <FormField label="Question Title" required>
              <textarea
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="What would you like to focus on?"
                rows={2}
              />
            </FormField>
            <FormField label="Options (JSON)" required>
              <textarea
                value={JSON.stringify(element.state.options || [], null, 2)}
                onChange={(e) => {
                  try {
                    const options = JSON.parse(e.target.value);
                    handleDataChange('options', options);
                  } catch {
                    // Invalid JSON
                  }
                }}
                placeholder={`[\n  {\n    "id": "opt1",\n    "title": "Option 1",\n    "description": "Description"\n  }\n]`}
                rows={10}
                className="json-editor"
              />
            </FormField>
          </>
        );

      case 'checkboxButton':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Checkbox label"
              />
            </FormField>
            <FormField label="Option Value" required>
              <input
                type="text"
                value={element.state.option as string || ''}
                onChange={(e) => handleDataChange('option', e.target.value)}
                placeholder="option_value"
              />
            </FormField>
            <FormField label="Initially Selected">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={element.state.isSelected as boolean || false}
                  onChange={(e) => handleDataChange('isSelected', e.target.checked)}
                />
                <span>Checked by default</span>
              </label>
            </FormField>
          </>
        );

      case 'imageCheckboxButton':
        return (
          <>
            <FormField label="Title" required>
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Option title"
              />
            </FormField>
            <FormField label="Caption">
              <input
                type="text"
                value={element.state.caption as string || ''}
                onChange={(e) => handleDataChange('caption', e.target.value)}
                placeholder="Optional caption"
              />
            </FormField>
            <FormField label="Image Name" required>
              <input
                type="text"
                value={element.state.imageName as string || ''}
                onChange={(e) => handleDataChange('imageName', e.target.value)}
                placeholder="icon_name"
              />
            </FormField>
            <FormField label="Background Color" required>
              <input
                type="text"
                value={element.state.backgroundColor as string || ''}
                onChange={(e) => handleDataChange('backgroundColor', e.target.value)}
                placeholder="backgroundTeaGreen"
              />
            </FormField>
            <FormField label="Option Value" required>
              <input
                type="text"
                value={element.state.option as string || ''}
                onChange={(e) => handleDataChange('option', e.target.value)}
                placeholder="option_value"
              />
            </FormField>
          </>
        );

      case 'circularStepper':
        return (
          <>
            <FormField label="Label">
              <input
                type="text"
                value={element.state.label as string || ''}
                onChange={(e) => handleDataChange('label', e.target.value)}
                placeholder="Count"
              />
            </FormField>
            <FormField label="Initial Value" required>
              <input
                type="number"
                value={element.state.value as number || 0}
                onChange={(e) => handleDataChange('value', parseInt(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Min Value" required>
              <input
                type="number"
                value={element.state.minValue as number || 0}
                onChange={(e) => handleDataChange('minValue', parseInt(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Max Value" required>
              <input
                type="number"
                value={element.state.maxValue as number || 10}
                onChange={(e) => handleDataChange('maxValue', parseInt(e.target.value) || 10)}
              />
            </FormField>
            <FormField label="Step" required>
              <input
                type="number"
                value={element.state.step as number || 1}
                onChange={(e) => handleDataChange('step', parseInt(e.target.value) || 1)}
              />
            </FormField>
          </>
        );

      case 'miniWidget':
        return (
          <>
            <FormField label="Title">
              <input
                type="text"
                value={element.state.title as string || ''}
                onChange={(e) => handleDataChange('title', e.target.value)}
                placeholder="Widget title"
              />
            </FormField>
            <FormField label="Content">
              <input
                type="text"
                value={element.state.content as string || ''}
                onChange={(e) => handleDataChange('content', e.target.value)}
                placeholder="Main content/value"
              />
            </FormField>
            <FormField label="Subtitle">
              <input
                type="text"
                value={element.state.subtitle as string || ''}
                onChange={(e) => handleDataChange('subtitle', e.target.value)}
                placeholder="Secondary text"
              />
            </FormField>
            <FormField label="Title Icon Name">
              <input
                type="text"
                value={element.state.titleIconName as string || ''}
                onChange={(e) => handleDataChange('titleIconName', e.target.value)}
                placeholder="icon_name"
              />
            </FormField>
            <FormField label="Show Action Arrow">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={element.state.showActionArrow as boolean || false}
                  onChange={(e) => handleDataChange('showActionArrow', e.target.checked)}
                />
                <span>Display arrow indicator</span>
              </label>
            </FormField>
          </>
        );

      case 'image':
        return (
          <FormField label="Image Name" required>
            <input
              type="text"
              value={element.state.imageName as string || ''}
              onChange={(e) => handleDataChange('imageName', e.target.value)}
              placeholder="image_name"
            />
          </FormField>
        );

      case 'careCall':
        return (
          <>
            <FormField label="Reason" required>
              <input
                type="text"
                value={element.state.reason as string || ''}
                onChange={(e) => handleDataChange('reason', e.target.value)}
                placeholder="Welcome Call"
              />
            </FormField>
            <FormField label="Participant" required>
              <input
                type="text"
                value={element.state.participant as string || ''}
                onChange={(e) => handleDataChange('participant', e.target.value)}
                placeholder="Care Team"
              />
            </FormField>
            <FormField label="Duration (minutes)" required>
              <input
                type="number"
                value={element.state.duration as number || 30}
                onChange={(e) => handleDataChange('duration', parseInt(e.target.value) || 30)}
              />
            </FormField>
            <FormField label="Call Type" required>
              <input
                type="text"
                value={element.state.callType as string || ''}
                onChange={(e) => handleDataChange('callType', e.target.value)}
                placeholder="video call"
              />
            </FormField>
            <FormField label="CTA Title" required>
              <input
                type="text"
                value={element.state.ctaTitle as string || ''}
                onChange={(e) => handleDataChange('ctaTitle', e.target.value)}
                placeholder="Join Call"
              />
            </FormField>
            <FormField label="Time (ISO)" required>
              <input
                type="datetime-local"
                value={element.state.time as string || ''}
                onChange={(e) => handleDataChange('time', new Date(e.target.value).toISOString())}
              />
            </FormField>
            <FormField label="Can Be Joined">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={element.state.canBeJoined as boolean || false}
                  onChange={(e) => handleDataChange('canBeJoined', e.target.checked)}
                />
                <span>Enable join button</span>
              </label>
            </FormField>
            <FormField label="Alert Text">
              <input
                type="text"
                value={element.state.alertText as string || ''}
                onChange={(e) => handleDataChange('alertText', e.target.value)}
                placeholder="Please join 5 minutes early"
              />
            </FormField>
          </>
        );

      case 'animatedImage':
        return (
          <FormField label="Lottie Animation" required>
            <select
              value={element.state.lottieName as string || ''}
              onChange={(e) => handleDataChange('lottieName', e.target.value)}
            >
              <option value="">Select animation...</option>
              <optgroup label="Pelago - Color">
                {AVAILABLE_ANIMATIONS.filter(a => a.startsWith('COLOR_Pelago_')).map(name => (
                  <option key={name} value={name}>{name.replace('COLOR_Pelago_', '')}</option>
                ))}
              </optgroup>
              <optgroup label="Pelago - B&W">
                {AVAILABLE_ANIMATIONS.filter(a => a.startsWith('B&W_Pelago_')).map(name => (
                  <option key={name} value={name}>{name.replace('B&W_Pelago_', '')}</option>
                ))}
              </optgroup>
              <optgroup label="Success Animations">
                {AVAILABLE_ANIMATIONS.filter(a => a.includes('Success')).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
              <optgroup label="Other">
                {AVAILABLE_ANIMATIONS.filter(a => 
                  !a.startsWith('COLOR_Pelago_') && 
                  !a.startsWith('B&W_Pelago_') && 
                  !a.includes('Success')
                ).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </optgroup>
            </select>
          </FormField>
        );

      case 'weekCheckinSummary':
        return (
          <>
            <FormField label="Week Number" required>
              <input
                type="number"
                value={element.state.weekNumber as number || 1}
                onChange={(e) => handleDataChange('weekNumber', parseInt(e.target.value) || 1)}
              />
            </FormField>
            <FormField label="Check-in Count" required>
              <input
                type="number"
                value={element.state.checkinCount as number || 0}
                onChange={(e) => handleDataChange('checkinCount', parseInt(e.target.value) || 0)}
              />
            </FormField>
            <FormField label="Target Count" required>
              <input
                type="number"
                value={element.state.targetCount as number || 7}
                onChange={(e) => handleDataChange('targetCount', parseInt(e.target.value) || 7)}
              />
            </FormField>
          </>
        );

      case 'agentMessageCard':
        return (
          <>
            <FormField label="Message" required>
              <textarea
                value={element.state.message as string || ''}
                onChange={(e) => handleDataChange('message', e.target.value)}
                placeholder="Agent message text"
                rows={4}
              />
            </FormField>
            <FormField label="Agent Name">
              <input
                type="text"
                value={element.state.agentName as string || ''}
                onChange={(e) => handleDataChange('agentName', e.target.value)}
                placeholder="Agent"
              />
            </FormField>
            <FormField label="Avatar">
              <input
                type="text"
                value={element.state.avatar as string || ''}
                onChange={(e) => handleDataChange('avatar', e.target.value)}
                placeholder="🤖"
              />
            </FormField>
          </>
        );

      case 'spacer':
        return null; // Spacer only has style properties

      case 'loadingView':
        return null; // Loading view has no configurable state

      case 'animatedComponents':
        // Complex nested structure, keep JSON editor
        return (
          <FormField label="Elements (JSON)" required>
            <textarea
              value={JSON.stringify(element.state.elements || [], null, 2)}
              onChange={(e) => {
                try {
                  const elements = JSON.parse(e.target.value);
                  handleDataChange('elements', elements);
                } catch {
                  // Invalid JSON
                }
              }}
              rows={10}
              className="json-editor"
              placeholder="Array of element configs"
            />
          </FormField>
        );

      default:
        // Fallback to JSON editor for any unmapped types
        return (
          <FormField label="Data (JSON)" required>
            <textarea
              value={JSON.stringify(element.state, null, 2)}
              onChange={(e) => {
                try {
                  const state = JSON.parse(e.target.value);
                  onChange({ state });
                } catch {
                  // Invalid JSON
                }
              }}
              rows={8}
              className="json-editor"
            />
          </FormField>
        );
    }
  };

  const renderStyleFields = () => {
    switch (element.type) {
      case 'button':
        return (
          <>
            <FormField label="Style" required>
              <select
                value={getStyleValue(element.style, 'style', 'primary')}
                onChange={(e) => handleStyleChange('style', e.target.value)}
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="tertiary">Tertiary</option>
                <option value="alert">Alert</option>
              </select>
            </FormField>
            <FormField label="Size" required>
              <select
                value={getStyleValue(element.style, 'size', 'large')}
                onChange={(e) => handleStyleChange('size', e.target.value)}
              >
                <option value="large">Large</option>
                <option value="medium">Medium</option>
                <option value="small">Small</option>
              </select>
            </FormField>
          </>
        );

      case 'textBlock':
        return (
          <>
            <FormField label="Style" required>
              <select
                value={getStyleValue(element.style, 'style', 'body1')}
                onChange={(e) => handleStyleChange('style', e.target.value)}
              >
                <option value="heading1">Heading 1</option>
                <option value="heading2">Heading 2</option>
                <option value="heading3">Heading 3</option>
                <option value="heading4">Heading 4</option>
                <option value="body1">Body 1</option>
                <option value="body2">Body 2</option>
                <option value="caption">Caption</option>
              </select>
            </FormField>
            <FormField label="Alignment">
              <select
                value={getStyleValue(element.style, 'alignment', 'leading')}
                onChange={(e) => handleStyleChange('alignment', e.target.value)}
              >
                <option value="leading">Left</option>
                <option value="center">Center</option>
                <option value="trailing">Right</option>
              </select>
            </FormField>
            <FormField label="Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'color', '')}
                onChange={(e) => handleStyleChange('color', e.target.value)}
                placeholder="e.g., primary, secondary"
              />
            </FormField>
          </>
        );

      case 'imageCard':
        return (
          <>
            <FormField label="Image Name" required>
              <input
                type="text"
                value={getStyleValue(element.style, 'imageName', '')}
                onChange={(e) => handleStyleChange('imageName', e.target.value)}
                placeholder="e.g., Success"
              />
            </FormField>
            <FormField label="Image Width">
              <input
                type="number"
                value={getStyleValue(element.style, 'imageWidth', '')}
                onChange={(e) => handleStyleChange('imageWidth', parseInt(e.target.value) || null)}
                placeholder="72"
              />
            </FormField>
            <FormField label="Image Height">
              <input
                type="number"
                value={getStyleValue(element.style, 'imageHeight', '')}
                onChange={(e) => handleStyleChange('imageHeight', parseInt(e.target.value) || null)}
                placeholder="72"
              />
            </FormField>
            <FormField label="Background Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'backgroundColor', '')}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="e.g., backgroundTeaGreen"
              />
            </FormField>
            <FormField label="Corner Radius">
              <input
                type="number"
                value={getStyleValue(element.style, 'cornerRadius', '')}
                onChange={(e) => handleStyleChange('cornerRadius', parseInt(e.target.value) || null)}
                placeholder="8"
              />
            </FormField>
          </>
        );

      case 'toggleCard':
        return (
          <>
            <FormField label="Icon">
              <input
                type="text"
                value={getStyleValue(element.style, 'icon', '')}
                onChange={(e) => handleStyleChange('icon', e.target.value)}
                placeholder="e.g., Notification"
              />
            </FormField>
            <FormField label="Background Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'backgroundColor', '')}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="e.g., secondaryDisabled"
              />
            </FormField>
            <FormField label="Border Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'borderColor', '')}
                onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                placeholder="e.g., secondaryDefault"
              />
            </FormField>
            <FormField label="Corner Radius">
              <input
                type="number"
                value={getStyleValue(element.style, 'cornerRadius', '')}
                onChange={(e) => handleStyleChange('cornerRadius', parseInt(e.target.value) || null)}
                placeholder="8"
              />
            </FormField>
          </>
        );

      case 'spacer': {
        const spacerHeight = getStyleValue(element.style, 'height', null);
        return (
          <>
            <FormField label="Height (px)">
              <div className="spacer-height-field">
                <input
                  type="number"
                  value={spacerHeight ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleStyleChange('height', value === '' ? null : parseInt(value));
                  }}
                  placeholder="Leave empty for flexible"
                />
                <button
                  type="button"
                  className="clear-height-btn"
                  onClick={() => handleStyleChange('height', null)}
                  title="Clear height (fills space)"
                >
                  Clear
                </button>
              </div>
              <span className="field-hint">
                {spacerHeight == null
                  ? '✓ Flexible - will fill available space'
                  : `Fixed height: ${spacerHeight}px`}
              </span>
            </FormField>
            <FormField label="Direction">
              <select
                value={getStyleValue(element.style, 'direction', 'vertical')}
                onChange={(e) => handleStyleChange('direction', e.target.value)}
              >
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </FormField>
          </>
        );
      }

      case 'checklistCard':
      case 'quoteCard':
        return (
          <>
            <FormField label="Background Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'backgroundColor', '')}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="e.g., backgroundLightTeaGreen"
              />
            </FormField>
            <FormField label="Corner Radius">
              <input
                type="number"
                value={getStyleValue(element.style, 'cornerRadius', '')}
                onChange={(e) => handleStyleChange('cornerRadius', parseInt(e.target.value) || null)}
                placeholder="12"
              />
            </FormField>
          </>
        );

      case 'miniWidget':
        return (
          <>
            <FormField label="Text Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'textColor', '')}
                onChange={(e) => handleStyleChange('textColor', e.target.value)}
                placeholder="e.g., textGlobalPrimary"
              />
            </FormField>
            <FormField label="Background Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'backgroundColor', '')}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="e.g., backgroundMistBlue"
              />
            </FormField>
            <FormField label="Border Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'borderColor', '')}
                onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                placeholder="e.g., backgroundPurple"
              />
            </FormField>
            <FormField label="Border Dashed">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={getStyleValue(element.style, 'borderDashed', false) as boolean}
                  onChange={(e) => handleStyleChange('borderDashed', e.target.checked)}
                />
                <span>Use dashed border</span>
              </label>
            </FormField>
            <FormField label="Show Alert">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={getStyleValue(element.style, 'showAlert', false) as boolean}
                  onChange={(e) => handleStyleChange('showAlert', e.target.checked)}
                />
                <span>Display alert indicator</span>
              </label>
            </FormField>
          </>
        );

      case 'image':
      case 'animatedImage':
        return (
          <>
            <FormField label="Width (px)">
              <input
                type="number"
                value={getStyleValue(element.style, 'width', '')}
                onChange={(e) => handleStyleChange('width', parseInt(e.target.value) || null)}
                placeholder="200"
              />
            </FormField>
            <FormField label="Height (px)">
              <input
                type="number"
                value={getStyleValue(element.style, 'height', '')}
                onChange={(e) => handleStyleChange('height', parseInt(e.target.value) || null)}
                placeholder="200"
              />
            </FormField>
            {element.type === 'image' && (
              <FormField label="Content Mode">
                <select
                  value={getStyleValue(element.style, 'contentMode', 'fit')}
                  onChange={(e) => handleStyleChange('contentMode', e.target.value)}
                >
                  <option value="fit">Fit</option>
                  <option value="fill">Fill</option>
                </select>
              </FormField>
            )}
          </>
        );

      case 'imageCheckboxButton':
        return (
          <>
            <FormField label="Image Dimension">
              <select
                value={getStyleValue(element.style, 'imageDimension', 'icon')}
                onChange={(e) => handleStyleChange('imageDimension', e.target.value)}
              >
                <option value="icon">Icon</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </FormField>
            <FormField label="Recolor">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={getStyleValue(element.style, 'recolor', false) as boolean}
                  onChange={(e) => handleStyleChange('recolor', e.target.checked)}
                />
                <span>Recolor image</span>
              </label>
            </FormField>
          </>
        );

      case 'checkboxButton':
        return (
          <FormField label="Height (px)">
            <input
              type="number"
              value={getStyleValue(element.style, 'height', '')}
              onChange={(e) => handleStyleChange('height', parseInt(e.target.value) || null)}
              placeholder="24"
            />
          </FormField>
        );

      case 'animatedComponents':
        return (
          <>
            <FormField label="Duration (seconds)">
              <input
                type="number"
                step="0.1"
                value={getStyleValue(element.style, 'duration', 2.0)}
                onChange={(e) => handleStyleChange('duration', parseFloat(e.target.value) || 2.0)}
                placeholder="2.0"
              />
            </FormField>
            <FormField label="Loop">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={getStyleValue(element.style, 'loop', false) as boolean}
                  onChange={(e) => handleStyleChange('loop', e.target.checked)}
                />
                <span>Loop animation</span>
              </label>
            </FormField>
            <FormField label="Auto Start">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={getStyleValue(element.style, 'autoStart', true) as boolean}
                  onChange={(e) => handleStyleChange('autoStart', e.target.checked)}
                />
                <span>Start automatically</span>
              </label>
            </FormField>
            <FormField label="Direction">
              <select
                value={getStyleValue(element.style, 'direction', 'forward')}
                onChange={(e) => handleStyleChange('direction', e.target.value)}
              >
                <option value="forward">Forward</option>
                <option value="reverse">Reverse</option>
              </select>
            </FormField>
            <FormField label="Curve">
              <select
                value={getStyleValue(element.style, 'curve', 'easeInOut')}
                onChange={(e) => handleStyleChange('curve', e.target.value)}
              >
                <option value="linear">Linear</option>
                <option value="easeIn">Ease In</option>
                <option value="easeOut">Ease Out</option>
                <option value="easeInOut">Ease In Out</option>
              </select>
            </FormField>
          </>
        );

      case 'agentMessageCard':
      case 'weekCheckinSummary':
        // These have minimal or no style configuration
        if (!element.style) return null;
        return (
          <>
            <FormField label="Background Color">
              <input
                type="text"
                value={getStyleValue(element.style, 'backgroundColor', '')}
                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                placeholder="backgroundLightCard"
              />
            </FormField>
            <FormField label="Corner Radius">
              <input
                type="number"
                value={getStyleValue(element.style, 'cornerRadius', '')}
                onChange={(e) => handleStyleChange('cornerRadius', parseInt(e.target.value) || null)}
                placeholder="12"
              />
            </FormField>
          </>
        );

      default:
        // Fallback to JSON editor
        if (!element.style) return null;
        return (
          <FormField label="Style (JSON)">
            <textarea
              value={JSON.stringify(element.style, null, 2)}
              onChange={(e) => {
                try {
                  const style = JSON.parse(e.target.value);
                  onChange({ style });
                } catch {
                  // Invalid JSON
                }
              }}
              rows={6}
              className="json-editor"
            />
          </FormField>
        );
    }
  };

  return (
    <div className="element-property-editor">
      {/* Position Controls */}
      {(onMoveUp || onMoveDown) && (
        <div className="element-property-position-controls">
          <button
            className="element-property-move-btn"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move element up"
          >
            ↑ Move Up
          </button>
          <button
            className="element-property-move-btn"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move element down"
          >
            ↓ Move Down
          </button>
        </div>
      )}

      <div className="element-property-section">
        <h4>Data</h4>
        <FormField label="Element ID" required>
          <input
            type="text"
            value={element.state.id as string || ''}
            onChange={(e) => handleDataChange('id', e.target.value)}
            placeholder="unique-id"
          />
        </FormField>
        {renderDataFields()}
      </div>

      {element.style && (
        <div className="element-property-section">
          <h4>Style</h4>
          {renderStyleFields()}
        </div>
      )}

      <button
        className="element-property-remove-btn"
        onClick={onRemove}
      >
        Remove Element
      </button>
    </div>
  );
};

// Helper component for form fields
const FormField: React.FC<{ 
  label: string; 
  required?: boolean; 
  children: React.ReactNode;
}> = ({ label, required, children }) => {
  return (
    <div className="form-field">
      <label className="form-field-label">
        {label}
        {required && <span className="form-field-required">*</span>}
      </label>
      <div className="form-field-input">
        {children}
      </div>
    </div>
  );
};

export default ElementPropertyEditor;

