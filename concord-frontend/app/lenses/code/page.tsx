'use client';

import { useState, useRef } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, FileCode, Terminal, FolderTree, Plus, X,
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  Sparkles, RefreshCw, TestTube, Copy,
  Download, Zap, Brain,
  CheckCircle, Loader2,
  Save, FileJson, FileText, Maximize2, Minimize2
} from 'lucide-react';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  language?: string;
  content?: string;
  children?: FileNode[];
  isExpanded?: boolean;
}

interface Tab {
  id: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

type AnalysisMode = 'analyze' | 'debug' | 'review' | 'generate' | 'refactor' | 'test' | 'explain';

const ANALYSIS_MODES: { id: AnalysisMode; name: string; icon: React.ElementType; color: string; prompt: string }[] = [
  { id: 'analyze', name: 'Analyze', icon: Brain, color: 'text-neon-blue', prompt: 'Analyze this code and suggest improvements' },
  { id: 'debug', name: 'Debug', icon: Bug, color: 'text-red-400', prompt: 'Find bugs and potential issues in this code' },
  { id: 'review', name: 'Review', icon: CheckCircle, color: 'text-green-400', prompt: 'Perform a code review with best practices' },
  { id: 'generate', name: 'Generate', icon: Sparkles, color: 'text-neon-purple', prompt: 'Generate code based on this template' },
  { id: 'refactor', name: 'Refactor', icon: RefreshCw, color: 'text-neon-yellow', prompt: 'Refactor this code for better readability and performance' },
  { id: 'test', name: 'Test', icon: TestTube, color: 'text-neon-cyan', prompt: 'Generate unit tests for this code' },
  { id: 'explain', name: 'Explain', icon: FileText, color: 'text-gray-400', prompt: 'Explain this code in detail' },
];

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
  { id: 'python', name: 'Python', ext: '.py' },
  { id: 'rust', name: 'Rust', ext: '.rs' },
  { id: 'go', name: 'Go', ext: '.go' },
  { id: 'java', name: 'Java', ext: '.java' },
  { id: 'cpp', name: 'C++', ext: '.cpp' },
  { id: 'html', name: 'HTML', ext: '.html' },
  { id: 'css', name: 'CSS', ext: '.css' },
  { id: 'json', name: 'JSON', ext: '.json' },
];

const MOCK_FILES: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    isExpanded: true,
    children: [
      {
        id: 'components',
        name: 'components',
        type: 'folder',
        children: [
          { id: 'Button.tsx', name: 'Button.tsx', type: 'file', language: 'typescript', content: 'export const Button = ({ children }) => {\n  return <button className="btn">{children}</button>;\n};' },
          { id: 'Modal.tsx', name: 'Modal.tsx', type: 'file', language: 'typescript', content: '// Modal component' },
        ],
      },
      {
        id: 'utils',
        name: 'utils',
        type: 'folder',
        children: [
          { id: 'helpers.ts', name: 'helpers.ts', type: 'file', language: 'typescript', content: 'export const formatDate = (date: Date) => {\n  return date.toLocaleDateString();\n};' },
        ],
      },
      { id: 'index.ts', name: 'index.ts', type: 'file', language: 'typescript', content: 'import { App } from "./App";\n\nexport default App;' },
    ],
  },
  { id: 'package.json', name: 'package.json', type: 'file', language: 'json', content: '{\n  "name": "my-project",\n  "version": "1.0.0"\n}' },
  { id: 'README.md', name: 'README.md', type: 'file', language: 'markdown', content: '# My Project\n\nDescription here...' },
];

const DEFAULT_CODE = `// Welcome to Code Lens
// Write or paste your code here for AI-powered analysis

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// This recursive implementation has exponential time complexity
// Try using the "Refactor" mode to see optimized versions

const result = fibonacci(10);
console.log(result);
`;

export default function CodeLensPage() {
  useLensNav('code');

  const [files, setFiles] = useState<FileNode[]>(MOCK_FILES);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'main', name: 'main.ts', language: 'typescript', content: DEFAULT_CODE, isDirty: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('main');
  const [output, setOutput] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('analyze');
  const [showFileTree, setShowFileTree] = useState(true);
  const [showOutput, setShowOutput] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [_searchQuery, _setSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const mode = ANALYSIS_MODES.find((m) => m.id === analysisMode);
      const res = await api.post('/api/ask', {
        query: `${mode?.prompt}:\n\n\`\`\`${activeTab.language}\n${activeTab.content}\n\`\`\``,
        mode: 'debug',
      });
      return res.data;
    },
    onSuccess: (data) => {
      setOutput(data.answer || data.reply || 'No analysis available');
      setShowOutput(true);
    },
    onError: (error: Record<string, unknown>) => {
      setOutput(`Error: ${error.message || 'Analysis failed'}`);
    },
  });

  const updateTabContent = (content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, content, isDirty: true } : tab
      )
    );
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const openFile = (file: FileNode) => {
    if (file.type !== 'file') return;

    const existingTab = tabs.find((t) => t.id === file.id);
    if (existingTab) {
      setActiveTabId(file.id);
      return;
    }

    const newTab: Tab = {
      id: file.id,
      name: file.name,
      language: file.language || 'plaintext',
      content: file.content || '',
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(file.id);
  };

  const toggleFolder = (folderId: string) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] =>
      nodes.map((node) => {
        if (node.id === folderId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNodes(node.children) };
        }
        return node;
      });
    setFiles(updateNodes(files));
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const Icon = isFolder
      ? node.isExpanded
        ? FolderOpen
        : Folder
      : File;

    return (
      <div key={node.id}>
        <button
          onClick={() => isFolder ? toggleFolder(node.id) : openFile(node)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-lattice-elevated rounded transition-colors ${
            activeTabId === node.id ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-400'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isFolder && (
            <span className="w-4 h-4 flex items-center justify-center">
              {node.isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          <Icon className={`w-4 h-4 ${isFolder ? 'text-neon-yellow' : 'text-neon-blue'}`} />
          <span className="truncate">{node.name}</span>
        </button>
        {isFolder && node.isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getLanguageIcon = (lang: string) => {
    switch (lang) {
      case 'typescript':
      case 'javascript':
        return <FileCode className="w-4 h-4 text-neon-blue" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-neon-yellow" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-lattice-deep' : 'h-[calc(100vh-4rem)]'}`}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-lattice-border bg-lattice-surface/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💻</span>
          <div>
            <h1 className="text-lg font-bold">Code Lens</h1>
            <p className="text-xs text-gray-400">AI-powered code analysis studio</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Analysis Mode Selector */}
          <div className="flex items-center gap-1 bg-lattice-deep rounded-lg p-1">
            {ANALYSIS_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAnalysisMode(mode.id)}
                  className={`p-2 rounded-md transition-colors ${
                    analysisMode === mode.id
                      ? 'bg-lattice-elevated ' + mode.color
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={mode.name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="btn-neon flex items-center gap-2"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {ANALYSIS_MODES.find((m) => m.id === analysisMode)?.name}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* File Tree Sidebar */}
        <AnimatePresence>
          {showFileTree && (
            <motion.aside
              initial={{ width: 0 }}
              animate={{ width: 240 }}
              exit={{ width: 0 }}
              className="border-r border-lattice-border bg-lattice-surface/30 overflow-hidden"
            >
              <div className="w-60 h-full flex flex-col">
                <div className="p-2 border-b border-lattice-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Explorer</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400">
                      <FolderTree className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto py-2">
                  {files.map((file) => renderFileNode(file))}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-lattice-surface/50 border-b border-lattice-border overflow-x-auto">
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              className="p-1.5 rounded hover:bg-lattice-elevated text-gray-400 flex-shrink-0"
            >
              <FolderTree className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-colors ${
                    tab.id === activeTabId
                      ? 'bg-lattice-deep border-t border-l border-r border-lattice-border text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {getLanguageIcon(tab.language)}
                  <span className="text-sm">{tab.name}</span>
                  {tab.isDirty && <span className="w-2 h-2 bg-neon-blue rounded-full" />}
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-lattice-border/50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className="p-1.5 rounded hover:bg-lattice-elevated text-gray-400 flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Editor + Output Split */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Code Editor */}
            <div className={`flex-1 flex flex-col overflow-hidden ${showOutput ? 'lg:w-1/2' : ''}`}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-lattice-deep border-b border-lattice-border">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{activeTab.language}</span>
                  <span>•</span>
                  <span>{activeTab.content.split('\n').length} lines</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400" title="Save">
                    <Save className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400" title="Copy">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0 flex">
                  {/* Line numbers */}
                  <div className="w-12 bg-lattice-deep border-r border-lattice-border text-right py-4 pr-3 text-xs text-gray-600 font-mono select-none overflow-hidden">
                    {activeTab.content.split('\n').map((_, idx) => (
                      <div key={idx} className="leading-6">{idx + 1}</div>
                    ))}
                  </div>
                  {/* Code area */}
                  <textarea
                    ref={textareaRef}
                    value={activeTab.content}
                    onChange={(e) => updateTabContent(e.target.value)}
                    className="flex-1 bg-lattice-deep p-4 font-mono text-sm text-white resize-none focus:outline-none leading-6"
                    spellCheck={false}
                    placeholder="// Write or paste code here"
                  />
                </div>
              </div>
            </div>

            {/* Output Panel */}
            <AnimatePresence>
              {showOutput && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '50%' }}
                  exit={{ width: 0 }}
                  className="border-l border-lattice-border flex flex-col overflow-hidden bg-lattice-surface/30"
                >
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-lattice-border">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-neon-green" />
                      <span className="text-sm font-medium">Analysis Output</span>
                    </div>
                    <button
                      onClick={() => setShowOutput(false)}
                      className="p-1 rounded hover:bg-lattice-elevated text-gray-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {analyzeMutation.isPending ? (
                      <div className="flex items-center gap-3 text-neon-blue">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Analyzing code with {ANALYSIS_MODES.find((m) => m.id === analysisMode)?.name} mode...</span>
                      </div>
                    ) : output ? (
                      <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap">{output}</pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Brain className="w-12 h-12 mb-4 opacity-30" />
                        <p>Select a mode and click to analyze your code</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-lattice-deep border-t border-lattice-border text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>Ln 1, Col 1</span>
              <span>Spaces: 2</span>
              <span>UTF-8</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-neon-yellow" />
                AI Ready
              </span>
              <select
                value={activeTab.language}
                onChange={(e) =>
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === activeTabId ? { ...t, language: e.target.value } : t
                    )
                  )
                }
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
