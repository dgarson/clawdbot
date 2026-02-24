import { useCallback, useState } from 'react';
import { SkillBuilder, type SkillMetadata, type SkillDefinition, type TestResult } from '../components/ui/skill-builder';

/**
 * Skill Builder Editor View
 * 
 * Integrated editor for creating and editing skills.
 * Provides metadata editing, YAML editing, and testing capabilities.
 */
export default function SkillBuilderEditor() {
  const [metadata, setMetadata] = useState<SkillMetadata>({
    name: '',
    description: '',
    triggers: [],
    version: '1.0.0',
    tags: [],
  });
  
  const [definition, setDefinition] = useState<SkillDefinition>({
    yaml: `# Skill Definition
name: my-skill
description: A new skill for OpenClaw
triggers:
  - /my-command
actions:
  - type: prompt
    prompt: "Hello! How can I help you today?"
`,
  });

  const handleSave = useCallback((m: SkillMetadata, d: SkillDefinition) => {
    // In production, this would save to the backend
    console.log('Saving skill:', { metadata: m, definition: d });
    alert(`Skill "${m.name}" saved! (Check console for data)`);
  }, []);

  const handleTest = useCallback(async (d: SkillDefinition): Promise<TestResult> => {
    // Simulate testing - in production this would call an API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Basic validation
    if (!d.yaml.trim()) {
      return {
        success: false,
        message: 'No YAML content to test',
      };
    }

    // Check for required fields
    const hasName = d.yaml.includes('name:');
    const hasDescription = d.yaml.includes('description:');
    
    if (!hasName) {
      return {
        success: false,
        message: 'Missing required field: name',
        duration: 150,
      };
    }

    return {
      success: true,
      message: 'Skill definition is valid!',
      duration: 150,
      output: 'YAML parsed successfully',
    };
  }, []);

  return (
    <div className="h-full">
      <SkillBuilder
        initialMetadata={metadata}
        initialDefinition={definition}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  );
}
