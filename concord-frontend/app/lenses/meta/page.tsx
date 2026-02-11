'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Wand2, Layout, Code, Eye, Palette, Settings, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { ErrorState } from '@/components/common/EmptyState';

interface LensTemplateData {
  name: string;
  description: string;
  category: string;
  components: string[];
}

interface ComponentData {
  name: string;
  icon: string;
}

interface GeneratedLensData {
  lensName: string;
  description: string;
  components: string[];
  code: string;
  generatedAt: string;
}

const SEED_TEMPLATES = [
  { title: 'Data Viewer', data: { name: 'Data Viewer', description: 'Display and filter DTU data', category: 'display', components: ['DataGrid', 'FilterBar', 'Pagination'] } },
  { title: 'Visualization', data: { name: 'Visualization', description: 'Charts and graphs', category: 'display', components: ['Graph', 'Legend', 'Controls'] } },
  { title: 'Form Builder', data: { name: 'Form Builder', description: 'Input and submission', category: 'input', components: ['Form', 'Validation', 'Submit'] } },
  { title: 'Dashboard', data: { name: 'Dashboard', description: 'Metrics overview', category: 'display', components: ['MetricCards', 'Charts', 'Activity'] } },
];

const SEED_COMPONENTS = [
  { title: 'DataGrid', data: { name: 'DataGrid', icon: 'Layout' } },
  { title: 'Chart', data: { name: 'Chart', icon: 'Eye' } },
  { title: 'Form', data: { name: 'Form', icon: 'Settings' } },
  { title: 'CodeView', data: { name: 'CodeView', icon: 'Code' } },
  { title: 'ThemePicker', data: { name: 'ThemePicker', icon: 'Palette' } },
];

const ICON_MAP: Record<string, typeof Layout> = {
  Layout,
  Eye,
  Settings,
  Code,
  Palette,
};

export default function MetaLensPage() {
  useLensNav('meta');
  const [lensName, setLensName] = useState('');
  const [lensDescription, setLensDescription] = useState('');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Templates from backend
  const {
    items: templateItems,
    isLoading: templatesLoading, isError: isError, error: error, refetch: refetch,
  } = useLensData<LensTemplateData>('meta', 'template', {
    seed: SEED_TEMPLATES,
  });

  // Component library from backend
  const {
    items: componentItems,
    isLoading: componentsLoading, isError: isError2, error: error2, refetch: refetch2,
  } = useLensData<ComponentData>('meta', 'component', {
    seed: SEED_COMPONENTS,
  });

  // Generated lenses history
  const {
    items: generatedItems,
    isLoading: generatedLoading, isError: isError3, error: error3, refetch: refetch3,
    create: createGeneratedLens,
  } = useLensData<GeneratedLensData>('meta', 'generated-lens', { seed: [] });

  const templates = templateItems.map(item => ({
    id: item.id,
    name: item.data.name || item.title,
    description: item.data.description || '',
    category: item.data.category || 'display',
    components: item.data.components || [],
  }));

  const componentLibrary = componentItems.map(item => ({
    id: item.id,
    name: item.data.name || item.title,
    icon: ICON_MAP[item.data.icon] || Layout,
  }));

  const toggleComponent = (id: string) => {
    setSelectedComponents((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!lensName || selectedComponents.length === 0) return;

    setGenerating(true);
    setGeneratedCode(null);
    try {
      const componentNames = selectedComponents
        .map(id => componentLibrary.find(c => c.id === id)?.name || id)
        .join(', ');

      const prompt = `Generate a Next.js React lens component called "${lensName}" with description: "${lensDescription}". ` +
        `It should include these components: ${componentNames}. ` +
        `Use 'use client' directive, Tailwind CSS with neon-* color classes, and lucide-react icons. ` +
        `Return only the TSX code.`;

      const response = await apiHelpers.chat.ask(prompt, 'meta');
      const respData = response.data;

      // Extract the generated code from the response
      const code = typeof respData === 'string'
        ? respData
        : respData?.reply || respData?.answer || respData?.message || respData?.code || JSON.stringify(respData, null, 2);

      setGeneratedCode(code);

      // Persist the generated lens
      await createGeneratedLens({
        title: lensName,
        data: {
          lensName,
          description: lensDescription,
          components: selectedComponents.map(id => componentLibrary.find(c => c.id === id)?.name || id),
          code,
          generatedAt: new Date().toISOString(),
        } as unknown as Partial<GeneratedLensData>,
        meta: { tags: ['generated', 'lens'], status: 'generated' },
      });
    } catch {
      setGeneratedCode('// Error: Failed to generate lens code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const isLoading = templatesLoading || componentsLoading || generatedLoading;


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">&#x1F528;</span>
        <div>
          <h1 className="text-xl font-bold">Meta Lens</h1>
          <p className="text-sm text-gray-400">
            Builder for custom lenses - extend the lensbuilder/forge
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading meta lens data...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="lens-card">
              <Wand2 className="w-5 h-5 text-neon-purple mb-2" />
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-sm text-gray-400">Templates</p>
            </div>
            <div className="lens-card">
              <Layout className="w-5 h-5 text-neon-blue mb-2" />
              <p className="text-2xl font-bold">{componentLibrary.length}</p>
              <p className="text-sm text-gray-400">Components</p>
            </div>
            <div className="lens-card">
              <Code className="w-5 h-5 text-neon-green mb-2" />
              <p className="text-2xl font-bold">{generatedItems.length || '0'}</p>
              <p className="text-sm text-gray-400">Generated Lenses</p>
            </div>
            <div className="lens-card">
              <Eye className="w-5 h-5 text-neon-cyan mb-2" />
              <p className="text-2xl font-bold">Live</p>
              <p className="text-sm text-gray-400">Preview</p>
            </div>
          </div>

          {/* Lens Builder */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-neon-purple" />
              Create New Lens
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Lens Name</label>
                <input
                  type="text"
                  value={lensName}
                  onChange={(e) => setLensName(e.target.value)}
                  placeholder="My Custom Lens"
                  className="input-lattice w-full"
                  disabled={generating}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Description</label>
                <input
                  type="text"
                  value={lensDescription}
                  onChange={(e) => setLensDescription(e.target.value)}
                  placeholder="What does this lens do?"
                  className="input-lattice w-full"
                  disabled={generating}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">Select Components</label>
              <div className="flex flex-wrap gap-2">
                {componentLibrary.map((comp) => {
                  const Icon = comp.icon;
                  const selected = selectedComponents.includes(comp.id);
                  return (
                    <button
                      key={comp.id}
                      onClick={() => toggleComponent(comp.id)}
                      disabled={generating}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        selected
                          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                          : 'bg-lattice-surface text-gray-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {comp.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!lensName || selectedComponents.length === 0 || generating}
              className="btn-neon purple w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Code className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Generate Lens Code'}
            </button>
          </div>

          {/* Generated Code */}
          {generatedCode && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Code className="w-4 h-4 text-neon-green" />
                Generated Code
              </h2>
              <pre className="bg-lattice-deep rounded-lg p-4 overflow-x-auto text-sm font-mono text-gray-300 max-h-96 overflow-y-auto">
                {generatedCode}
              </pre>
            </div>
          )}

          {/* Templates */}
          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Layout className="w-4 h-4 text-neon-blue" />
              Starter Templates
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setLensName(template.name);
                    setLensDescription(template.description);
                  }}
                  className="lens-card text-left hover:border-neon-cyan"
                >
                  <p className="font-semibold mb-1">{template.name}</p>
                  <p className="text-xs text-gray-400 mb-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.components.map((c) => (
                      <span key={c} className="text-xs px-1.5 py-0.5 bg-lattice-surface rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generated Lenses History */}
          {generatedItems.length > 0 && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-neon-purple" />
                Previously Generated Lenses
              </h2>
              <div className="space-y-2">
                {generatedItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg cursor-pointer hover:bg-lattice-surface"
                    onClick={() => {
                      setLensName(item.data.lensName || item.title);
                      setLensDescription(item.data.description || '');
                      setGeneratedCode(item.data.code || null);
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">{item.data.lensName || item.title}</p>
                      <p className="text-xs text-gray-500">
                        {item.data.components?.join(', ') || 'No components'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {item.data.generatedAt
                        ? new Date(item.data.generatedAt).toLocaleDateString()
                        : new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
