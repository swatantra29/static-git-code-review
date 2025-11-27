
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, Github, GitBranch, GitCommit, GitPullRequest, Folder, File, ChevronRight, ChevronDown, Moon, Sun, BrainCircuit, Bot, Layout, FileSearch, Settings, Key, AlertCircle, LogOut, Users, Book, X, ExternalLink, Activity, Layers, ShieldCheck, Zap, RefreshCw, Trash2, Plus, Lock, Loader2, History, Clock, ChevronLeft } from 'lucide-react';
import { ReviewHistoryService, SavedReview } from '../services/reviewHistoryService';
import { Button } from './Button';
import { Sidebar } from './Sidebar';
import { RepoInfo, Commit, FileNode, Branch, Contributor, PullRequest, ViewState, DetailView, AIAnalysisResult, ManagedKey, RepoEntry } from '../types';
import { parseGithubUrl, fetchRepoDetails } from '../services/githubService';
import { generateReviewStream } from '../services/geminiService';
import { generateReviewStreamOllama } from '../services/ollamaService';
import { KeyManager } from '../services/keyManager';
import { APP_NAME } from '../constants';
import { loadRepoCSV } from '../utils/csvLoader';
import { normalizeGitHubUrl } from '../utils/urlHelpers';

// --- Components ---

// Speedometer Gauge
const SpeedGauge: React.FC<{ label: string; score: number; size?: 'sm' | 'md' | 'lg'; color?: string }> = ({ label, score, size = 'md', color }) => {
  const radius = size === 'lg' ? 40 : size === 'md' ? 24 : 16;
  const stroke = size === 'lg' ? 6 : size === 'md' ? 4 : 3;
  const normalizedScore = Math.min(100, Math.max(0, score || 0));
  const circumference = 2 * Math.PI * radius;
  const dashArray = `${(normalizedScore / 100) * circumference} ${circumference}`;
  
  let strokeColor = color;
  if (!strokeColor) {
    if (score >= 80) strokeColor = 'hsl(140, 70%, 50%)'; 
    else if (score >= 50) strokeColor = 'hsl(40, 90%, 50%)'; 
    else strokeColor = 'hsl(0, 80%, 60%)';
  }

  const textSize = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-sm' : 'text-[10px]';

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg 
          width={radius * 2 + stroke * 2} 
          height={radius * 2 + stroke * 2} 
          className="transform -rotate-90"
        >
          <circle cx="50%" cy="50%" r={radius} stroke="hsl(var(--surface-3))" strokeWidth={stroke} fill="transparent" />
          <circle cx="50%" cy="50%" r={radius} stroke={strokeColor} strokeWidth={stroke} fill="transparent" strokeDasharray={dashArray} strokeLinecap="round" />
        </svg>
        <div className={`absolute font-bold text-[hsl(var(--text-main))] ${textSize}`}>{score}</div>
      </div>
      <span className="text-[hsl(var(--text-dim))] text-xs font-semibold uppercase tracking-wider text-center">{label}</span>
    </div>
  );
};

// Modal Component
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--surface-2))]">
          <h3 className="text-lg font-bold text-[hsl(var(--text-main))]">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-[hsl(var(--surface-2))] rounded text-[hsl(var(--text-dim))] hover:text-[hsl(var(--text-main))]"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

// File Tree Item
const FileTreeItem: React.FC<{ name: string; item: any; depth: number }> = ({ name, item, depth }) => {
  const [isOpen, setIsOpen] = useState(depth < 2); // Auto expand top levels
  const isFolder = item.children && Object.keys(item.children).length > 0;
  const paddingLeft = `${depth * 1.5}rem`;

  if (!isFolder) {
    return (
      <a 
        href={item.data?.html_url} 
        target="_blank" 
        rel="noreferrer"
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-dim))] hover:text-[hsl(var(--primary))] transition-colors rounded text-sm font-mono group border-l border-transparent hover:border-[hsl(var(--primary))]"
        style={{ paddingLeft }}
      >
        <File size={14} className="shrink-0 opacity-50 group-hover:opacity-100" />
        <span className="truncate">{name}</span>
      </a>
    );
  }

  return (
    <div>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-[hsl(var(--surface-2))] text-[hsl(var(--text-main))] cursor-pointer transition-colors rounded text-sm font-medium select-none"
        style={{ paddingLeft }}
      >
        {isOpen ? <ChevronDown size={14} className="shrink-0 text-[hsl(var(--primary))]" /> : <ChevronRight size={14} className="shrink-0 text-[hsl(var(--text-dim))]" />}
        <Folder size={14} className={`shrink-0 ${isOpen ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--text-dim))]'}`} />
        <span className="truncate">{name}</span>
      </div>
      {isOpen && (
        <div className="border-l border-[hsl(var(--surface-2))] ml-2">
          {Object.keys(item.children).sort().map((childName) => (
            <FileTreeItem key={childName} name={childName} item={item.children[childName]} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const buildTree = (files: FileNode[]) => {
  const tree = { children: {} };
  files.forEach(file => {
    const parts = file.path.split('/');
    let current: any = tree;
    parts.forEach((part, index) => {
      if (!current.children[part]) {
        current.children[part] = { children: {} };
      }
      current = current.children[part];
      if (index === parts.length - 1) {
        current.data = file;
      }
    });
  });
  return tree;
};

// --- Main Dashboard ---

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [url, setUrl] = useState('');
  const [viewState, setViewState] = useState<ViewState>(ViewState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Data States
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [readme, setReadme] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Record<string, number>>({});
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reviewMarkdown, setReviewMarkdown] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [usageMetadata, setUsageMetadata] = useState<{input: number, output: number, total: number} | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);

  // Review History States
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<SavedReview[]>([]);
  const [loadedReviewId, setLoadedReviewId] = useState<string | null>(null);

  // Settings State
  const [managedKeys, setManagedKeys] = useState<ManagedKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<'github' | 'gemini'>('github');
  const [newKeyToken, setNewKeyToken] = useState('');
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'ollama'>('gemini');

  // CSV/Dropdown States
  const [repoEntries, setRepoEntries] = useState<RepoEntry[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [inputMode, setInputMode] = useState<'manual' | 'dropdown'>('manual');

  // Modal States
  const [showBranchesModal, setShowBranchesModal] = useState(false);
  const [showContributorsModal, setShowContributorsModal] = useState(false);
  const [showCommitsModal, setShowCommitsModal] = useState(false);
  const [showPRsModal, setShowPRsModal] = useState(false);
  const [showReadmeModal, setShowReadmeModal] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load Keys on Mount/Settings Open
  useEffect(() => {
    setManagedKeys(KeyManager.getKeys());
  }, [showSettings]);

  // Load CSV on mount
  useEffect(() => {
    const loadRepos = async () => {
      const entries = await loadRepoCSV();
      if (entries.length > 0) {
        setRepoEntries(entries);
        setInputMode('dropdown');
      }
    };
    loadRepos();
  }, []);

  // Load review history on mount and when showReviewHistory changes
  useEffect(() => {
    setReviewHistory(ReviewHistoryService.getAll());
  }, [showReviewHistory]);

  // Save review when AI analysis completes (when isReviewing goes from true to false and we have content)
  const previousIsReviewing = React.useRef(isReviewing);
  useEffect(() => {
    if (previousIsReviewing.current && !isReviewing && reviewMarkdown && repoInfo && aiAnalysis && !loadedReviewId) {
      // Analysis just completed, save the review
      ReviewHistoryService.save(
        repoInfo,
        reviewMarkdown,
        aiAnalysis,
        commits.length,
        pullRequests.length
      );
      setReviewHistory(ReviewHistoryService.getAll());
    }
    previousIsReviewing.current = isReviewing;
  }, [isReviewing, reviewMarkdown, repoInfo, aiAnalysis, commits.length, pullRequests.length, loadedReviewId]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyName && newKeyToken) {
      KeyManager.addKey(newKeyName, newKeyType, newKeyToken);
      setManagedKeys(KeyManager.getKeys());
      setNewKeyName('');
      setNewKeyToken('');
    }
  };

  const handleDeleteKey = (id: string) => {
    KeyManager.removeKey(id);
    setManagedKeys(KeyManager.getKeys());
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine which URL to use
    let repoUrl = url;
    if (inputMode === 'dropdown' && selectedTeam) {
      const entry = repoEntries.find(e => e.team_name === selectedTeam);
      if (entry) {
        repoUrl = entry.repo_link;
      }
    }

    // Normalize the URL
    const normalizedUrl = normalizeGitHubUrl(repoUrl);
    if (!normalizedUrl) {
      setError('Invalid GitHub URL format. Supported formats: https://github.com/owner/repo, git@github.com:owner/repo.git, or github.com/owner/repo');
      return;
    }

    const parsed = parseGithubUrl(normalizedUrl);
    if (!parsed) {
      setError('Could not parse GitHub repository URL');
      return;
    }

    setViewState(ViewState.LOADING_REPO);
    setError(null);
    setRepoInfo(null);
    setAiAnalysis(null); 
    setReviewMarkdown('');
    setUsageMetadata(null);

    try {
      const data = await fetchRepoDetails(parsed.owner, parsed.repo);
      setRepoInfo(data.info);
      setCommits(data.commits);
      setPullRequests(data.pullRequests);
      setFiles(data.files);
      setBranches(data.branches);
      setContributors(data.contributors);
      setReadme(data.readme);
      setLanguages(data.languages);
      setViewState(ViewState.REPO_LOADED);
      
      // Show info message if repository is empty (don't block the UI)
      if (data.files.length === 0 && data.commits.length === 0) {
        console.info('ℹ️ Repository appears to be empty or newly created');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repository data');
      setViewState(ViewState.IDLE);
    }
  };

  const resetRepo = () => {
    setRepoInfo(null);
    setUrl('');
    setAiAnalysis(null);
    setReviewMarkdown('');
    setUsageMetadata(null);
    setViewState(ViewState.IDLE);
    setLoadedReviewId(null);
  }

  // Load a saved review from history
  const handleLoadReview = async (savedReview: SavedReview) => {
    // Set loaded review ID to prevent re-saving
    setLoadedReviewId(savedReview.id);
    
    // Restore the review data
    setReviewMarkdown(savedReview.reviewMarkdown);
    setAiAnalysis(savedReview.aiAnalysis);
    setUsageMetadata(savedReview.aiAnalysis?.tokenUsage || null);
    
    // Fetch fresh metadata from GitHub API
    const parsed = parseGithubUrl(savedReview.repoUrl);
    if (parsed) {
      setViewState(ViewState.LOADING_REPO);
      setError(null);
      try {
        const data = await fetchRepoDetails(parsed.owner, parsed.repo);
        setRepoInfo(data.info);
        setCommits(data.commits);
        setPullRequests(data.pullRequests);
        setFiles(data.files);
        setBranches(data.branches);
        setContributors(data.contributors);
        setReadme(data.readme);
        setLanguages(data.languages);
        setViewState(ViewState.REPO_LOADED);
        setShowReviewHistory(false);
        setIsSidebarOpen(true); // Open sidebar to show the review
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch repository data');
        setViewState(ViewState.IDLE);
      }
    }
  };

  // Delete a saved review
  const handleDeleteReview = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ReviewHistoryService.delete(id);
    setReviewHistory(ReviewHistoryService.getAll());
  };

  const handleReview = async () => {
    if (!repoInfo) return;
    
    // Clear loadedReviewId to allow saving this new review
    setLoadedReviewId(null);
    setIsSidebarOpen(true);
    setReviewMarkdown('');
    setIsReviewing(true);
    setViewState(ViewState.ANALYZING);
    setUsageMetadata(null);

    const requestData = {
      repo: repoInfo,
      commits: commits,
      pullRequests: pullRequests, 
      files: files,
      contributors: contributors,
      languages: languages,
      readme: readme
    };

    try {
      // Choose stream based on provider
      const stream = llmProvider === 'ollama' 
        ? generateReviewStreamOllama(requestData)
        : generateReviewStream(requestData);

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
            setReviewMarkdown(prev => prev + chunk.content);
        } else if (chunk.type === 'usage' && chunk.data) {
            setUsageMetadata(chunk.data);
        }
      }
    } catch (e) {
      setReviewMarkdown(prev => prev + '\n\n**Error encountered during generation.**');
    } finally {
      setIsReviewing(false);
      setViewState(ViewState.REPO_LOADED);
    }
  };

  const handleAnalysisComplete = (result: AIAnalysisResult) => {
    setAiAnalysis(prev => ({
        ...result,
        tokenUsage: usageMetadata || undefined
    }));
  };

  const getLangColor = (lang: string) => {
    const map: Record<string, string> = {
      TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
      HTML: '#e34c26', CSS: '#563d7c', Rust: '#dea584', Go: '#00ADD8',
      Java: '#b07219', 'C++': '#f34b7d', Ruby: '#701516', Shell: '#89e051'
    };
    return map[lang] || '#8b949e';
  };

  const totalCommits = contributors.reduce((acc, curr) => acc + curr.contributions, 0);

  return (
    <div className="flex-1 flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-main))] overflow-hidden transition-colors duration-300 relative">
      
      {/* Settings Modal (New Key Manager) */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] p-6 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-6 border-b border-[hsl(var(--surface-2))] pb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Settings size={20} className="text-[hsl(var(--primary))]" /> Secure Key Manager</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-[hsl(var(--surface-2))] rounded"><X size={20}/></button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar pr-2">
                  
                  {/* LLM Provider Selection */}
                  <div className="bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-bold text-[hsl(var(--text-main))] mb-3 flex items-center gap-2"><Bot size={16}/> LLM Provider</h4>
                      <div className="flex gap-3">
                          <button
                              onClick={() => setLlmProvider('gemini')}
                              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                                  llmProvider === 'gemini'
                                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                                      : 'border-[hsl(var(--surface-2))] hover:border-[hsl(var(--surface-3))]'
                              }`}
                          >
                              <BrainCircuit size={20} className="mx-auto mb-2" />
                              <div className="font-bold text-sm">Google Gemini</div>
                              <div className="text-xs text-[hsl(var(--text-dim))]">Cloud API</div>
                          </button>
                          <button
                              onClick={() => setLlmProvider('ollama')}
                              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                                  llmProvider === 'ollama'
                                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                                      : 'border-[hsl(var(--surface-2))] hover:border-[hsl(var(--surface-3))]'
                              }`}
                          >
                              <Activity size={20} className="mx-auto mb-2" />
                              <div className="font-bold text-sm">Ollama (Local)</div>
                              <div className="text-xs text-[hsl(var(--text-dim))]">Windows Native</div>
                          </button>
                      </div>
                      {llmProvider === 'ollama' && (
                          <div className="mt-3 text-xs bg-blue-900/10 border border-blue-900/30 p-3 rounded space-y-2">
                              <div className="font-bold text-blue-400 flex items-center gap-1">
                                  <Activity size={12} /> Windows Setup Required
                              </div>
                              <div className="text-[hsl(var(--text-dim))] space-y-1">
                                  <div>1. Install Ollama: <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Download for Windows</a></div>
                                  <div>2. Verify running: <code className="text-[hsl(var(--primary))] font-mono text-[11px] bg-[hsl(var(--surface-2))] px-1 py-0.5 rounded">ollama list</code> in PowerShell</div>
                                  <div>3. Pull model: <code className="text-[hsl(var(--primary))] font-mono text-[11px] bg-[hsl(var(--surface-2))] px-1 py-0.5 rounded">ollama pull qwen2.5-coder:7b</code></div>
                                  <div className="pt-1 border-t border-blue-900/20 text-[10px]">
                                      Ollama runs in the background on <code className="text-[hsl(var(--primary))]">localhost:11434</code>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* API Keys Section - Only show for Gemini */}
                  {llmProvider === 'gemini' && (
                      <>
                          <div className="bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg p-4 mb-6">
                              <h4 className="text-sm font-bold text-[hsl(var(--text-main))] mb-3 flex items-center gap-2"><Plus size={16}/> Add New Key</h4>
                              <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                          <div className="space-y-1 md:col-span-1">
                              <label className="text-xs text-[hsl(var(--text-dim))]">Key Name</label>
                              <input 
                                  type="text" 
                                  placeholder="My Personal Key" 
                                  value={newKeyName}
                                  onChange={e => setNewKeyName(e.target.value)}
                                  className="w-full bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded px-3 py-2 text-sm focus:border-[hsl(var(--primary))] outline-none"
                              />
                          </div>
                          <div className="space-y-1 md:col-span-1">
                              <label className="text-xs text-[hsl(var(--text-dim))]">Type</label>
                              <select 
                                  value={newKeyType}
                                  onChange={e => setNewKeyType(e.target.value as any)}
                                  className="w-full bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded px-3 py-2 text-sm focus:border-[hsl(var(--primary))] outline-none"
                              >
                                  <option value="github">GitHub Token</option>
                                  <option value="gemini">Gemini API Key</option>
                              </select>
                          </div>
                          <div className="space-y-1 md:col-span-2 relative group">
                              <label className="text-xs text-[hsl(var(--text-dim))]">Token (Encrypted Storage)</label>
                              <input 
                                  type="password" 
                                  placeholder="ghp_... or AIza..." 
                                  value={newKeyToken}
                                  onChange={e => setNewKeyToken(e.target.value)}
                                  className="w-full bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded px-3 py-2 text-sm focus:border-[hsl(var(--primary))] outline-none"
                              />
                          </div>
                          <div className="md:col-span-4 flex justify-end mt-2">
                             <Button type="submit" className="py-1.5 px-4 text-xs h-9">Save Key Securely</Button>
                          </div>
                      </form>
                  </div>

                  <h4 className="text-sm font-bold text-[hsl(var(--text-dim))] mb-2 uppercase tracking-wider">Managed Keys</h4>
                  <div className="space-y-2">
                      {managedKeys.length === 0 && (
                          <div className="text-center py-8 text-[hsl(var(--text-dim))] border border-dashed border-[hsl(var(--surface-2))] rounded-lg">
                              No custom keys added. Using system defaults if available.
                          </div>
                      )}
                      {managedKeys.map(key => (
                          <div key={key.id} className="flex items-center justify-between p-3 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded bg-[hsl(var(--surface-2))] ${key.type === 'github' ? 'text-white' : 'text-blue-400'}`}>
                                      {key.type === 'github' ? <Github size={16}/> : <BrainCircuit size={16}/>}
                                  </div>
                                  <div>
                                      <div className="font-medium text-sm text-[hsl(var(--text-main))]">{key.name}</div>
                                      <div className="text-xs font-mono text-[hsl(var(--text-dim))] flex items-center gap-1">
                                          <Lock size={10} />
                                          {key.token.substring(0, 4)}••••••••••••••••••••{key.token.slice(-4)}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2">
                                  {key.isRateLimitedUntil && key.isRateLimitedUntil > Date.now() && (
                                      <span className="text-[10px] text-yellow-500 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-900/30">Rate Limited</span>
                                  )}
                                  <button onClick={() => handleDeleteKey(key.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors" title="Delete Key">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
                      </>
                  )}
              </div>
              <div className="mt-6 pt-4 border-t border-[hsl(var(--surface-2))] text-xs text-[hsl(var(--text-dim))] flex items-start gap-2">
                  <ShieldCheck size={14} className="text-green-500 shrink-0 mt-0.5" />
                  <p>Keys are obfuscated and stored in your browser's Local Storage. They are never sent to our servers, only directly to GitHub/Google APIs. If a key hits a rate limit, the system automatically rotates to the next available key of the same type.</p>
              </div>
           </div>
        </div>
      )}

      {/* Popups */}
      <Modal isOpen={showBranchesModal} onClose={() => setShowBranchesModal(false)} title="All Branches">
         <div className="grid grid-cols-2 gap-3">
            {branches.map(b => (
                <a key={b.name} href={b.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] hover:border-[hsl(var(--primary))] transition-colors group">
                    <GitBranch size={16} className="text-[hsl(var(--text-dim))] group-hover:text-[hsl(var(--primary))]" />
                    <span className="text-sm font-mono truncate">{b.name}</span>
                </a>
            ))}
         </div>
      </Modal>

      <Modal isOpen={showContributorsModal} onClose={() => setShowContributorsModal(false)} title="All Contributors">
         <div className="space-y-3">
            {contributors.map(c => {
                const percent = ((c.contributions / totalCommits) * 100).toFixed(1);
                return (
                <a key={c.id} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] hover:border-[hsl(var(--primary))] transition-colors group">
                    <div className="flex items-center gap-3">
                        <img src={c.avatar_url} className="w-10 h-10 rounded-full border border-[hsl(var(--surface-2))]" />
                        <div>
                            <div className="font-bold text-[hsl(var(--text-main))]">{c.login}</div>
                            <div className="text-xs text-[hsl(var(--text-dim))]">{c.contributions} commits</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="font-mono text-[hsl(var(--primary))] font-bold">{percent}%</span>
                        <div className="w-24 h-1.5 bg-[hsl(var(--surface-2))] rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-[hsl(var(--primary))]" style={{ width: `${percent}%`}}></div>
                        </div>
                    </div>
                </a>
            )})}
         </div>
      </Modal>

      <Modal isOpen={showCommitsModal} onClose={() => setShowCommitsModal(false)} title="All Commits">
        <div className="space-y-4">
            {commits.map(commit => (
                <div key={commit.sha} className="p-4 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-[hsl(var(--text-main))] text-sm">{commit.commit.message}</div>
                        <a href={commit.html_url} target="_blank" className="text-[10px] font-mono bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded text-[hsl(var(--text-dim))] hover:text-[hsl(var(--primary))]">{commit.sha.substring(0, 7)}</a>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-dim))]">
                            <span>{commit.commit.author.name}</span>
                            <span>•</span>
                            <span>{new Date(commit.commit.author.date).toLocaleDateString()}</span>
                        </div>
                        {/* Added stats display to popup */}
                        <div className="flex gap-2 text-xs font-mono">
                            <span className="text-green-500 bg-green-900/10 px-1 rounded">+{commit.stats?.additions || 0}</span>
                            <span className="text-red-500 bg-red-900/10 px-1 rounded">-{commit.stats?.deletions || 0}</span>
                        </div>
                    </div>
                    {aiAnalysis?.commitSummaries?.[commit.sha] && (
                        <div className="mt-3 text-sm text-[hsl(var(--text-main))] bg-[hsl(var(--surface-2))]/30 p-3 rounded border-l-2 border-[hsl(var(--primary))] leading-relaxed">
                             <Bot size={14} className="inline mr-2 text-[hsl(var(--primary))]"/> {aiAnalysis.commitSummaries[commit.sha]}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </Modal>

      <Modal isOpen={showPRsModal} onClose={() => setShowPRsModal(false)} title="Pull Requests">
          <div className="space-y-4">
              {pullRequests.map(pr => (
                  <div key={pr.id} className="p-4 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-[hsl(var(--text-main))] text-sm">#{pr.number} {pr.title}</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${pr.state === 'open' ? 'bg-green-900 text-green-200' : 'bg-purple-900 text-purple-200'}`}>{pr.state}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-dim))]">
                          <img src={pr.user.avatar_url} className="w-4 h-4 rounded-full"/>
                          <span>{pr.user.login}</span>
                      </div>
                       {aiAnalysis?.prSummaries?.[pr.number] && (
                        <div className="mt-3 text-sm text-[hsl(var(--text-main))] bg-[hsl(var(--surface-2))]/30 p-3 rounded border-l-2 border-[hsl(var(--primary))] leading-relaxed">
                             <Bot size={14} className="inline mr-2 text-[hsl(var(--primary))]"/> {aiAnalysis.prSummaries[pr.number]}
                        </div>
                    )}
                  </div>
              ))}
          </div>
      </Modal>

      <Modal isOpen={showReadmeModal} onClose={() => setShowReadmeModal(false)} title="README.md">
         <div className="prose prose-invert max-w-none">
            {readme ? (
                <ReactMarkdown>{readme}</ReactMarkdown>
            ) : (
                <div className="text-[hsl(var(--text-dim))]">No Readme found.</div>
            )}
         </div>
      </Modal>


      {/* Navbar */}
      <header className="h-16 border-b border-[hsl(var(--surface-2))] bg-[hsl(var(--bg))] flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[hsl(var(--primary))] to-indigo-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]">
            <BrainCircuit size={20} />
          </div>
          <span className="font-bold tracking-tight text-lg">{APP_NAME}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowReviewHistory(!showReviewHistory)} 
            className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              showReviewHistory 
                ? 'bg-[hsl(var(--primary))] text-white' 
                : 'text-[hsl(var(--text-dim))] hover:bg-[hsl(var(--surface-1))]'
            }`}
            title="Review History"
          >
            <History size={18} />
            {reviewHistory.length > 0 && (
              <span className={`text-xs font-bold ${showReviewHistory ? 'text-white' : 'text-[hsl(var(--primary))]'}`}>
                {reviewHistory.length}
              </span>
            )}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg text-[hsl(var(--text-dim))] hover:bg-[hsl(var(--surface-1))] transition-colors"><Settings size={18} /></button>
          <button onClick={toggleTheme} className="p-2 rounded-lg text-[hsl(var(--text-dim))] hover:bg-[hsl(var(--surface-1))] transition-colors">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="h-4 w-px bg-[hsl(var(--surface-2))]" />
          <button onClick={onLogout} className="text-xs text-[hsl(var(--text-dim))] hover:text-red-400 flex items-center gap-1 transition-colors font-medium"><LogOut size={14} /> Sign Out</button>
        </div>
      </header>

      {/* Review History Panel */}
      <div 
        className={`fixed inset-y-0 left-0 w-[350px] bg-[hsl(var(--surface-1))] shadow-[10px_0_30px_rgba(0,0,0,var(--shadow-strength))] transform transition-transform duration-300 ease-in-out z-40 flex flex-col border-r border-[hsl(var(--surface-2))] ${
          showReviewHistory ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[hsl(var(--surface-2))] bg-[hsl(var(--surface-1))] shrink-0">
          <h2 className="font-semibold text-lg text-[hsl(var(--text-main))] flex items-center gap-2">
            <History size={20} className="text-[hsl(var(--primary))]" />
            Review History
          </h2>
          <button 
            onClick={() => setShowReviewHistory(false)}
            className="p-2 text-[hsl(var(--text-dim))] hover:text-[hsl(var(--text-main))] transition-colors rounded-md hover:bg-[hsl(var(--surface-2))]"
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {reviewHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-[hsl(var(--text-dim))] text-center">
              <History size={48} strokeWidth={1} className="opacity-30 mb-4" />
              <p className="text-sm">No saved reviews yet</p>
              <p className="text-xs mt-1 opacity-70">Reviews will appear here after AI analysis</p>
            </div>
          ) : (
            reviewHistory.map(review => (
              <div 
                key={review.id} 
                onClick={() => handleLoadReview(review)}
                className={`p-3 bg-[hsl(var(--bg))] border rounded-lg cursor-pointer transition-all hover:border-[hsl(var(--primary))] hover:shadow-md group ${
                  loadedReviewId === review.id 
                    ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' 
                    : 'border-[hsl(var(--surface-2))]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-[hsl(var(--text-main))] text-sm truncate flex-1 mr-2">
                    {review.repoFullName}
                  </div>
                  <button 
                    onClick={(e) => handleDeleteReview(review.id, e)}
                    className="p-1 text-[hsl(var(--text-dim))] hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete review"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-dim))] mb-2">
                  <Clock size={12} />
                  <span>{new Date(review.savedAt).toLocaleDateString()} {new Date(review.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-[hsl(var(--text-dim))]">
                    <GitCommit size={12} /> {review.commitCount} commits
                  </span>
                  <span className="flex items-center gap-1 text-[hsl(var(--text-dim))]">
                    <GitPullRequest size={12} /> {review.prCount} PRs
                  </span>
                </div>
                
                {review.aiAnalysis?.scores && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-[hsl(var(--surface-2))]">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                      Quality: <span className="text-[hsl(var(--primary))] font-bold">{review.aiAnalysis.scores.quality}</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--surface-2))]">
                      Security: <span className="text-[hsl(var(--primary))] font-bold">{review.aiAnalysis.scores.security}</span>
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {reviewHistory.length > 0 && (
          <div className="p-4 border-t border-[hsl(var(--surface-2))] shrink-0">
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to clear all review history?')) {
                  ReviewHistoryService.clearAll();
                  setReviewHistory([]);
                }
              }}
              className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 size={12} /> Clear All History
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
        <div className="max-w-[1800px] mx-auto w-full space-y-8">
          
          {/* URL Input */}
          {!repoInfo && (
            <section className="space-y-4 pt-10">
              <h1 className="text-3xl font-bold text-[hsl(var(--text-main))]">Repository Intelligence</h1>
              <p className="text-[hsl(var(--text-dim))] max-w-2xl">Enter a public GitHub repository URL or select from teams.</p>
              
              {/* Input Mode Toggle */}
              {repoEntries.length > 0 && (
                <div className="flex gap-2 max-w-2xl">
                  <button
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                      inputMode === 'manual'
                        ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                        : 'bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] text-[hsl(var(--text-dim))] hover:border-[hsl(var(--primary))]'
                    }`}
                  >
                    <Github size={14} className="inline mr-1.5" />
                    Manual URL Entry
                  </button>
                  <button
                    onClick={() => setInputMode('dropdown')}
                    className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                      inputMode === 'dropdown'
                        ? 'bg-[hsl(var(--primary))] text-white shadow-lg'
                        : 'bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] text-[hsl(var(--text-dim))] hover:border-[hsl(var(--primary))]'
                    }`}
                  >
                    <Users size={14} className="inline mr-1.5" />
                    Select from Teams ({repoEntries.length})
                  </button>
                </div>
              )}

              <form onSubmit={handleFetch} className="flex flex-col gap-4 max-w-2xl mt-6">
                {inputMode === 'manual' ? (
                  <div className="flex-1 relative group">
                    <Github className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-dim))] w-5 h-5 group-focus-within:text-[hsl(var(--primary))] transition-colors" />
                    <input 
                      type="text" 
                      placeholder="https://github.com/owner/repo, git@github.com:owner/repo.git, or github.com/owner/repo"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      className="w-full bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-lg py-3 pl-12 pr-4 text-[hsl(var(--text-main))] focus:outline-none focus:border-[hsl(var(--primary))] transition-all"
                      disabled={viewState === ViewState.LOADING_REPO}
                    />
                    <p className="text-xs text-[hsl(var(--text-dim))] mt-2 ml-1">
                      Supports: https://github.com/owner/repo, github.com/owner/repo, git@github.com:owner/repo.git, or URLs ending with .git
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 relative group">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-dim))] w-5 h-5 group-focus-within:text-[hsl(var(--primary))] transition-colors" />
                    <select
                      value={selectedTeam}
                      onChange={e => setSelectedTeam(e.target.value)}
                      className="w-full bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-lg py-3 pl-12 pr-4 text-[hsl(var(--text-main))] focus:outline-none focus:border-[hsl(var(--primary))] transition-all appearance-none cursor-pointer"
                      disabled={viewState === ViewState.LOADING_REPO}
                    >
                      <option value="">-- Select a Team --</option>
                      {repoEntries.map((entry, idx) => (
                        <option key={idx} value={entry.team_name}>
                          {entry.team_name}
                        </option>
                      ))}
                    </select>
                    {selectedTeam && (
                      <p className="text-xs text-[hsl(var(--text-dim))] mt-2 ml-1 flex items-center gap-1.5">
                        <ExternalLink size={12} />
                        Repository: <span className="text-[hsl(var(--primary))] font-mono">{repoEntries.find(e => e.team_name === selectedTeam)?.repo_link}</span>
                      </p>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  isLoading={viewState === ViewState.LOADING_REPO}
                  disabled={
                    viewState === ViewState.LOADING_REPO || 
                    (inputMode === 'manual' && !url.trim()) ||
                    (inputMode === 'dropdown' && !selectedTeam)
                  }
                  className="w-full"
                >
                  {viewState === ViewState.LOADING_REPO ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={18}/>
                      Analyzing Repository...
                    </>
                  ) : (
                    <>
                      <Search size={18} className="mr-2" />
                      Fetch Repository Data
                    </>
                  )}
                </Button>
              </form>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-900/10 p-4 rounded-lg border border-red-900/30 max-w-2xl">
                  <AlertCircle size={20} /><span>{error}</span>
                </div>
              )}
            </section>
          )}

          {repoInfo && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">

               {/* Extended Header Area (Compact) */}
               <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-4 shadow-lg relative overflow-hidden flex flex-col gap-4">
                  
                  {/* Top: Repo Info + Actions */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 relative z-10 border-b border-[hsl(var(--surface-2))] pb-4">
                      <div className="flex gap-4 items-center">
                          <img src={repoInfo.owner.avatar_url} alt="" className="w-16 h-16 rounded-xl border border-[hsl(var(--surface-2))] shadow-sm" />
                          <div>
                             <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl font-bold text-[hsl(var(--text-main))]">{repoInfo.full_name}</h1>
                                {/* ADDED README BUTTON */}
                                <Button variant="secondary" onClick={() => setShowReadmeModal(true)} className="h-7 px-2 text-xs">
                                    <Book size={14} className="mr-1"/> Readme
                                </Button>
                             </div>
                             <p className="text-[hsl(var(--text-dim))] text-sm max-w-xl truncate">{repoInfo.description}</p>
                             <div className="flex gap-4 mt-2">
                                <a href={repoInfo.html_url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"><Github size={12}/> GitHub</a>
                                <div className="text-xs flex items-center gap-1 text-[hsl(var(--text-dim))]"><Activity size={12}/> {repoInfo.open_issues_count} issues</div>
                             </div>
                          </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 justify-center min-w-[180px]">
                         <Button onClick={handleReview} isLoading={isReviewing} className="shadow-lg w-full text-sm py-2">
                            <Zap size={14} className="mr-2" />
                            {aiAnalysis ? 'Re-Analyze Repo' : 'Start AI Review'}
                          </Button>
                          <div className="flex gap-2">
                             {reviewMarkdown && (
                                <Button variant="secondary" onClick={() => setIsSidebarOpen(true)} className="flex-1 text-sm py-2 h-9 px-2"><Layout size={14} className="mr-1"/> Report</Button>
                             )}
                             <Button variant="secondary" onClick={resetRepo} className="flex-1 text-sm py-2 h-9 px-2"><RefreshCw size={14} className="mr-1"/> Change</Button>
                          </div>
                      </div>
                  </div>

                  {/* Bottom: Gauges & Token Info (Compact) */}
                  {aiAnalysis && (
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 animate-in fade-in zoom-in duration-500">
                        <div className="flex gap-8 justify-center flex-1">
                             <SpeedGauge label="Quality" score={aiAnalysis.scores.quality} size="md" />
                             <SpeedGauge label="Security" score={aiAnalysis.scores.security} size="md" />
                             <SpeedGauge label="Reliability" score={aiAnalysis.scores.reliability} size="md" />
                        </div>
                        
                        <div className="bg-[hsl(var(--bg))] p-3 rounded-lg border border-[hsl(var(--surface-2))] min-w-[220px] shadow-inner">
                           <div className="text-[10px] text-[hsl(var(--text-dim))] uppercase font-bold tracking-wider mb-1 border-b border-[hsl(var(--surface-2))] pb-1">Token Usage</div>
                           <div className="grid grid-cols-2 gap-y-0.5 gap-x-2 text-xs font-mono">
                              <span className="text-[hsl(var(--text-dim))]">Input:</span> 
                              <span className="text-right text-[hsl(var(--primary))]">{usageMetadata?.input || 0}</span>
                              <span className="text-[hsl(var(--text-dim))]">Output:</span>
                              <span className="text-right text-[hsl(var(--primary))]">{usageMetadata?.output || 0}</span>
                              <span className="font-bold text-[hsl(var(--text-main))] pt-1 border-t border-[hsl(var(--surface-2))]">Total:</span>
                              <span className="font-bold text-right pt-1 border-t border-[hsl(var(--surface-2))]">{usageMetadata?.total || 0}</span>
                           </div>
                        </div>
                    </div>
                  )}
                  
                  {!aiAnalysis && (
                     <div className="flex items-center justify-center p-4 text-[hsl(var(--text-dim))] text-sm border-2 border-dashed border-[hsl(var(--surface-2))] rounded-lg bg-[hsl(var(--bg))]/30">
                        <Bot size={18} className="mr-2 opacity-50"/> 
                        <span>Run AI Review to generate scoring gauges.</span>
                     </div>
                  )}

               </div>

               {/* Row 1: Branches, Contributors, Languages (Smaller: h-[200px]) */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Branches */}
                  <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-4 shadow-sm flex flex-col h-[200px]">
                      <div className="flex justify-between items-center mb-2">
                         <h3 className="font-bold text-sm flex items-center gap-2"><GitBranch size={16} className="text-[hsl(var(--primary))]"/> Branches</h3>
                         <span className="text-[10px] font-mono bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded">{branches.length}</span>
                      </div>
                      <div className="flex-1 overflow-hidden relative space-y-1">
                            {branches.slice(0, 3).map(b => (
                                <a key={b.name} href={b.html_url} target="_blank" rel="noreferrer" className="block p-1.5 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded text-xs font-mono truncate text-[hsl(var(--text-dim))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors">
                                    {b.name}
                                </a>
                            ))}
                      </div>
                      <Button variant="secondary" className="w-full mt-2 h-8 text-xs" onClick={() => setShowBranchesModal(true)}>View All</Button>
                  </div>

                  {/* Contributors (Avatars Only) */}
                  <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-4 shadow-sm flex flex-col h-[200px]">
                      <div className="flex justify-between items-center mb-2">
                         <h3 className="font-bold text-sm flex items-center gap-2"><Users size={16} className="text-[hsl(var(--primary))]"/> Contributors</h3>
                         {aiAnalysis?.scores.teamBalance !== undefined && (
                             <div className="scale-75 origin-right"><SpeedGauge label="Balance" score={aiAnalysis.scores.teamBalance} size="sm" /></div>
                         )}
                      </div>
                      <div className="flex-1 flex flex-wrap content-start gap-2 overflow-hidden">
                         {contributors.slice(0, 8).map(c => (
                            <img key={c.id} src={c.avatar_url} title={c.login} className="w-8 h-8 rounded-full border border-[hsl(var(--surface-2))]" />
                         ))}
                         {contributors.length > 8 && (
                             <div className="w-8 h-8 rounded-full bg-[hsl(var(--surface-2))] flex items-center justify-center text-[10px] text-[hsl(var(--text-dim))]">
                                 +{contributors.length - 8}
                             </div>
                         )}
                      </div>
                      <Button variant="secondary" className="w-full mt-2 h-8 text-xs" onClick={() => setShowContributorsModal(true)}>View All</Button>
                  </div>

                  {/* Languages */}
                  <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-4 shadow-sm flex flex-col h-[200px]">
                      <div className="flex justify-between items-center mb-2">
                         <h3 className="font-bold text-sm flex items-center gap-2"><Layers size={16} className="text-[hsl(var(--primary))]"/> Languages</h3>
                         {aiAnalysis?.scores.techStackSuitability !== undefined && (
                             <div className="scale-75 origin-right"><SpeedGauge label="Tech Fit" score={aiAnalysis.scores.techStackSuitability} size="sm" /></div>
                         )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex h-3 w-full rounded-full overflow-hidden mb-3 bg-[hsl(var(--surface-2))]">
                            {Object.keys(languages).map(lang => {
                                const total = (Object.values(languages) as number[]).reduce((a, b) => a + b, 0);
                                const percent = (languages[lang] / total) * 100;
                                return <div key={lang} style={{ width: `${percent}%`, backgroundColor: getLangColor(lang) }} />;
                            })}
                        </div>
                        <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[80px] custom-scrollbar content-start">
                            {Object.keys(languages).slice(0, 8).map(lang => (
                                <span key={lang} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] text-[hsl(var(--text-dim))] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getLangColor(lang) }}></span>
                                    {lang}
                                </span>
                            ))}
                        </div>
                      </div>
                  </div>
               </div>

               {/* Row 2: Commits & PRs Split View */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px]">
                  
                  {/* Commits Section */}
                  <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-[hsl(var(--surface-2))] shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><GitCommit size={20} className="text-[hsl(var(--primary))]"/> Commits</h3>
                          <div className="flex items-center gap-4">
                             {aiAnalysis?.scores.commitQuality !== undefined && (
                                <SpeedGauge label="Quality" score={aiAnalysis.scores.commitQuality} size="sm" />
                             )}
                             <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setShowCommitsModal(true)}>View All</Button>
                          </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-2">
                          {commits.slice(0, 15).map(commit => {
                              const summary = aiAnalysis?.commitSummaries?.[commit.sha];
                              return (
                                  <div key={commit.sha} className="p-4 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg hover:border-[hsl(var(--primary))] transition-colors group">
                                      <div className="flex justify-between items-start mb-2">
                                          <div className="font-medium text-[hsl(var(--text-main))] text-sm line-clamp-1">{commit.commit.message}</div>
                                          <a href={commit.html_url} target="_blank" className="text-[10px] font-mono bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded text-[hsl(var(--text-dim))] opacity-0 group-hover:opacity-100 transition-opacity">{commit.sha.substring(0, 7)}</a>
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-dim))] mb-2">
                                          <span>{commit.commit.author.name}</span>
                                          <span>•</span>
                                          <span className="font-mono text-green-500">+{commit.stats?.additions || 0}</span>
                                          <span className="font-mono text-red-500">-{commit.stats?.deletions || 0}</span>
                                      </div>
                                      {summary ? (
                                          <div className="text-xs text-[hsl(var(--text-main))] bg-[hsl(var(--surface-2))]/30 p-2 rounded border-l-2 border-[hsl(var(--primary))] leading-relaxed text-justify">
                                              <Bot size={12} className="inline mr-1 text-[hsl(var(--primary))]"/> {summary}
                                          </div>
                                      ) : (
                                          <div className="text-xs text-[hsl(var(--text-dim))] italic opacity-30 pl-2 border-l-2 border-[hsl(var(--surface-2))]">
                                             Waiting for review...
                                          </div>
                                      )}
                                  </div>
                              )
                          })}
                      </div>
                  </div>

                  {/* PRs Section */}
                  <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-[hsl(var(--surface-2))] shrink-0">
                          <h3 className="font-bold text-lg flex items-center gap-2"><GitPullRequest size={20} className="text-[hsl(var(--primary))]"/> Pull Requests</h3>
                          <div className="flex items-center gap-4">
                             {aiAnalysis?.scores.prQuality !== undefined && (
                                <SpeedGauge label="Quality" score={aiAnalysis.scores.prQuality} size="sm" />
                             )}
                             <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setShowPRsModal(true)}>View All</Button>
                          </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-2">
                          {pullRequests.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--text-dim))]">
                                  <GitPullRequest size={32} className="mb-2 opacity-20"/>
                                  <p>No recent pull requests found.</p>
                              </div>
                          ) : (
                              pullRequests.map(pr => {
                                  const summary = aiAnalysis?.prSummaries?.[pr.number];
                                  return (
                                      <div key={pr.id} className="p-4 bg-[hsl(var(--bg))] border border-[hsl(var(--surface-2))] rounded-lg hover:border-[hsl(var(--primary))] transition-colors">
                                          <div className="flex justify-between items-start mb-2">
                                              <div className="font-medium text-[hsl(var(--text-main))] text-sm">#{pr.number} {pr.title}</div>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${pr.state === 'open' ? 'bg-green-900 text-green-200' : 'bg-purple-900 text-purple-200'}`}>{pr.state}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-dim))] mb-2">
                                              <img src={pr.user.avatar_url} className="w-4 h-4 rounded-full"/>
                                              <span>{pr.user.login}</span>
                                          </div>
                                          {summary ? (
                                            <div className="text-xs text-[hsl(var(--text-main))] bg-[hsl(var(--surface-2))]/30 p-2 rounded border-l-2 border-[hsl(var(--primary))] leading-relaxed text-justify">
                                                <Bot size={12} className="inline mr-1 text-[hsl(var(--primary))]"/> {summary}
                                            </div>
                                          ) : (
                                              <div className="text-xs text-[hsl(var(--text-dim))] italic opacity-30 pl-2 border-l-2 border-[hsl(var(--surface-2))]">Waiting for review...</div>
                                          )}
                                      </div>
                                  )
                              })
                          )}
                      </div>
                  </div>
               </div>

               {/* Row 3: File Tree (Vertical, Full Width) */}
               <div className="bg-[hsl(var(--surface-1))] border border-[hsl(var(--surface-2))] rounded-xl p-6 shadow-sm flex flex-col min-h-[500px]">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-[hsl(var(--surface-2))]">
                      <h3 className="font-bold text-lg flex items-center gap-2"><Folder size={20} className="text-[hsl(var(--primary))]"/> File Structure</h3>
                      {aiAnalysis?.scores.structureQuality !== undefined && (
                          <div className="flex items-center gap-4">
                              <SpeedGauge label="Structure" score={aiAnalysis.scores.structureQuality} size="md" />
                          </div>
                      )}
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar bg-[hsl(var(--bg))] rounded-lg border border-[hsl(var(--surface-2))] p-4">
                     {files.length > 0 ? (
                        <div className="space-y-1">
                             {(() => {
                                const tree = buildTree(files);
                                return Object.keys(tree.children).sort().map(childName => (
                                    <FileTreeItem key={childName} name={childName} item={(tree.children as any)[childName]} depth={0} />
                                ));
                            })()}
                        </div>
                     ) : (
                         <div className="text-center text-[hsl(var(--text-dim))] mt-10">
                           <p className="text-lg mb-2">📁 No files found</p>
                           <p className="text-sm">This repository appears to be empty or contains no accessible files.</p>
                         </div>
                     )}
                  </div>
               </div>
            </div>
          )}
          
        </div>
      </main>

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        markdown={reviewMarkdown}
        isGenerating={isReviewing}
        onAnalysisComplete={handleAnalysisComplete}
      />
    </div>
  );
};