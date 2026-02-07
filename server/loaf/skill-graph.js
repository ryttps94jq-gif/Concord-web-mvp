/**
 * LOAF II.5 — Skill Graph + Strategy Compiler
 *
 * Skill Graph:
 *   Nodes: strategies, domains, tools
 *   Edges: applicability, reliability, risk, negative-transfer probability
 *
 * Strategy Compiler:
 *   Input: task, constraints, tools, skill graph
 *   Output: plan, checkpoints, cost estimate, confidence
 */

/**
 * Skill Graph — a directed weighted graph of capabilities.
 */
class SkillGraph {
  constructor() {
    this.nodes = new Map();   // nodeId -> { id, type, name, metadata }
    this.edges = new Map();   // edgeId -> { id, from, to, type, weight, metadata }
    this.adjacency = new Map(); // nodeId -> Set<edgeId>
  }

  addNode(id, type, name, metadata = {}) {
    const node = {
      id: String(id),
      type, // "strategy" | "domain" | "tool"
      name: String(name),
      metadata: {
        applicability: Number(metadata.applicability ?? 0.5),
        reliability: Number(metadata.reliability ?? 0.5),
        risk: Number(metadata.risk ?? 0.1),
        ...metadata,
      },
      createdAt: new Date().toISOString(),
    };
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) this.adjacency.set(node.id, new Set());
    return node;
  }

  addEdge(from, to, type, weight = 1.0, metadata = {}) {
    const id = `${from}->${to}:${type}`;
    const edge = {
      id,
      from: String(from),
      to: String(to),
      type, // "applicability" | "reliability" | "risk" | "negative_transfer"
      weight: Math.max(0, Math.min(1, Number(weight))),
      metadata: {
        negativeTransferProb: Number(metadata.negativeTransferProb ?? 0),
        ...metadata,
      },
      createdAt: new Date().toISOString(),
    };
    this.edges.set(id, edge);

    // Update adjacency
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Set());
    this.adjacency.get(from).add(id);

    return edge;
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  getEdge(id) {
    return this.edges.get(id) || null;
  }

  /**
   * Get all edges from a node.
   */
  getOutEdges(nodeId) {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map(id => this.edges.get(id)).filter(Boolean);
  }

  /**
   * Get all edges to a node.
   */
  getInEdges(nodeId) {
    return Array.from(this.edges.values()).filter(e => e.to === nodeId);
  }

  /**
   * Find strategies applicable to a domain.
   */
  findStrategies(domainId) {
    const edges = this.getInEdges(domainId)
      .filter(e => e.type === "applicability" && this.nodes.get(e.from)?.type === "strategy");

    return edges
      .map(e => ({
        strategy: this.nodes.get(e.from),
        applicability: e.weight,
        negativeTransferProb: e.metadata.negativeTransferProb || 0,
      }))
      .sort((a, b) => b.applicability - a.applicability);
  }

  /**
   * Find tools usable by a strategy.
   */
  findTools(strategyId) {
    const edges = this.getOutEdges(strategyId)
      .filter(e => e.type === "reliability" && this.nodes.get(e.to)?.type === "tool");

    return edges
      .map(e => ({
        tool: this.nodes.get(e.to),
        reliability: e.weight,
      }))
      .sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Export the graph for serialization.
   */
  export() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Import a graph from serialized data.
   */
  import(data) {
    if (data?.nodes) {
      for (const n of data.nodes) this.addNode(n.id, n.type, n.name, n.metadata);
    }
    if (data?.edges) {
      for (const e of data.edges) this.addEdge(e.from, e.to, e.type, e.weight, e.metadata);
    }
  }

  stats() {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }
}

/**
 * Strategy Compiler.
 * Input: task, constraints, tools, skill graph
 * Output: plan, checkpoints, cost estimate, confidence
 */
function compileStrategy(task, constraints, availableTools, graph) {
  const taskDomain = String(task.domain || "general");
  const taskGoal = String(task.goal || task.description || "");

  // Find applicable strategies
  const strategies = graph.findStrategies(taskDomain);

  if (strategies.length === 0) {
    return {
      ok: false,
      error: "no_applicable_strategies",
      domain: taskDomain,
    };
  }

  // Filter by constraints
  let candidates = strategies;

  if (constraints?.maxRisk !== undefined) {
    candidates = candidates.filter(s =>
      (s.strategy.metadata.risk || 0) <= constraints.maxRisk
    );
  }

  if (constraints?.minReliability !== undefined) {
    candidates = candidates.filter(s =>
      (s.strategy.metadata.reliability || 0) >= constraints.minReliability
    );
  }

  if (constraints?.maxNegativeTransfer !== undefined) {
    candidates = candidates.filter(s =>
      (s.negativeTransferProb || 0) <= constraints.maxNegativeTransfer
    );
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "no_strategies_meet_constraints",
      domain: taskDomain,
      constraintsApplied: constraints,
    };
  }

  // Select best strategy
  const best = candidates[0];

  // Find tools for strategy
  const tools = graph.findTools(best.strategy.id);
  const matchedTools = tools.filter(t =>
    !availableTools || availableTools.length === 0 ||
    availableTools.includes(t.tool.id) || availableTools.includes(t.tool.name)
  );

  // Build plan
  const plan = {
    strategy: best.strategy.name,
    strategyId: best.strategy.id,
    domain: taskDomain,
    goal: taskGoal,
    steps: [
      { step: 1, action: "initialize", description: `Set up ${best.strategy.name} for ${taskDomain}` },
      { step: 2, action: "apply_strategy", description: `Apply ${best.strategy.name} to task` },
      ...matchedTools.map((t, i) => ({
        step: 3 + i,
        action: "use_tool",
        tool: t.tool.name,
        reliability: t.reliability,
        description: `Use ${t.tool.name} (reliability: ${(t.reliability * 100).toFixed(0)}%)`,
      })),
      { step: 3 + matchedTools.length, action: "validate", description: "Validate results against task goal" },
    ],
  };

  // Checkpoints
  const checkpoints = plan.steps
    .filter((_, i) => i === 0 || i === plan.steps.length - 1 || i === Math.floor(plan.steps.length / 2))
    .map(s => ({ step: s.step, action: s.action, checkpoint: `Verify after: ${s.description}` }));

  // Cost estimate
  const toolCost = matchedTools.reduce((s, t) => s + (1 - t.reliability) * 10, 0);
  const strategyCost = (1 - best.applicability) * 20;
  const costEstimate = {
    totalUnits: Math.round(toolCost + strategyCost + plan.steps.length),
    breakdown: {
      toolCost: Math.round(toolCost),
      strategyCost: Math.round(strategyCost),
      stepCost: plan.steps.length,
    },
  };

  // Confidence
  const confidence = best.applicability * (1 - best.negativeTransferProb) *
    (matchedTools.length > 0 ? matchedTools.reduce((s, t) => s + t.reliability, 0) / matchedTools.length : 0.5);

  return {
    ok: true,
    plan,
    checkpoints,
    costEstimate,
    confidence: Math.max(0, Math.min(1, confidence)),
    selectedStrategy: {
      name: best.strategy.name,
      applicability: best.applicability,
      risk: best.strategy.metadata.risk,
      negativeTransferProb: best.negativeTransferProb,
    },
    tools: matchedTools.map(t => ({ name: t.tool.name, reliability: t.reliability })),
  };
}

// Singleton skill graph
const skillGraph = new SkillGraph();

function init({ register, STATE, helpers: _helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.skillGraph = {
    stats: { nodesAdded: 0, edgesAdded: 0, compilations: 0 },
  };

  register("loaf.skillgraph", "status", (ctx) => {
    const sg = ctx.state.__loaf.skillGraph;
    return { ok: true, graph: skillGraph.stats(), stats: sg.stats };
  }, { public: true });

  register("loaf.skillgraph", "add_node", (ctx, input = {}) => {
    const sg = ctx.state.__loaf.skillGraph;
    const node = skillGraph.addNode(input.id, input.type, input.name, input.metadata);
    sg.stats.nodesAdded++;
    return { ok: true, node };
  }, { public: false });

  register("loaf.skillgraph", "add_edge", (ctx, input = {}) => {
    const sg = ctx.state.__loaf.skillGraph;
    const edge = skillGraph.addEdge(input.from, input.to, input.type, input.weight, input.metadata);
    sg.stats.edgesAdded++;
    return { ok: true, edge };
  }, { public: false });

  register("loaf.skillgraph", "find_strategies", (_ctx, input = {}) => {
    const strategies = skillGraph.findStrategies(String(input.domainId || ""));
    return { ok: true, strategies };
  }, { public: true });

  register("loaf.skillgraph", "compile", (ctx, input = {}) => {
    const sg = ctx.state.__loaf.skillGraph;
    sg.stats.compilations++;
    return compileStrategy(input.task || {}, input.constraints || {}, input.tools || [], skillGraph);
  }, { public: false });

  register("loaf.skillgraph", "export", (_ctx) => {
    return { ok: true, graph: skillGraph.export() };
  }, { public: true });

  register("loaf.skillgraph", "import", (_ctx, input = {}) => {
    skillGraph.import(input.data || {});
    return { ok: true, imported: skillGraph.stats() };
  }, { public: false });
}

export {
  SkillGraph,
  compileStrategy,
  skillGraph,
  init,
};
