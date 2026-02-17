// ===== COGNITIVE MACROS =====
// Extracted from server.js — CHICKEN3 helpers, meta-DTU helpers, and all cognitive domain macros
// (goals, worldmodel, semantic, transfer, experience, attention, reflection, commonsense,
//  grounding, reasoning, inference, hypothesis, metacognition, explanation, metalearning)

/**
 * Register all cognitive macros.
 * @param {Function} register - The macro register(domain, name, fn, spec) function
 * @param {Object} deps - Dependencies from server.js
 */
export function registerCognitiveMacros(register, deps) {
  const {
    STATE, enforceEthosInvariant, uid, nowISO, clamp, saveStateDebounced,
    log, _c2log, governedCall, generateMetaProposal, council,
    realtimeEmit, upsertDTU, councilGate, dtuForClient, cleanTitle,
    renderHumanDTU, allowMacro, TERMINAL_EXEC_ENABLED, DATA_DIR,
    ensureQueues, inLatticeReality, spawnSync, path, fs, structuredLog,
    BREAKERS, _cloudOptInAllowed, runMacro, clamp01,
    // Goal system
    ensureGoalSystem, createGoalProposal, evaluateGoal, activateGoal,
    updateGoalProgress, completeGoal, abandonGoal, generateAutoGoalProposals,
    GOAL_STATES, GOAL_INVARIANTS,
    // World model
    ensureWorldModel, createWorldEntity, createWorldRelation, getEntityWithRelations,
    runWorldSimulation, generateCounterfactual, takeWorldSnapshot, extractEntitiesFromDtu,
    WORLD_MODEL_INVARIANTS,
    // Semantic
    ensureSemanticEngine, findSimilarDtus, computeLocalEmbedding, classifySemanticIntent,
    extractEntities, extractSemanticRoles, cosineSimilarity, SEMANTIC_INVARIANTS,
    // Transfer
    ensureTransferEngine, classifyDomain, extractPattern, findAnalogousPatterns,
    applyPatternToTarget, TRANSFER_INVARIANTS,
    // Experience
    ensureExperienceLearning, retrieveExperience, consolidateExperience,
    // Attention
    ensureAttentionManager, createCognitiveThread, completeCognitiveThread, addBackgroundTask,
    // Reflection
    ensureReflectionEngine, reflectOnResponse,
    // Commonsense
    ensureCommonsenseSubstrate, queryCommonsense, addCommonsenseFact,
    surfaceAssumptions, COMMONSENSE_INVARIANTS,
    // Grounding
    ensureGroundingEngine, registerSensor, recordSensorReading, groundDtu,
    linkToCalendar, proposeAction, approveAction, getCurrentGroundedContext,
    GROUNDING_INVARIANTS,
    // Reasoning
    ensureReasoningEngine, createReasoningChain, addReasoningStep, concludeChain,
    getReasoningTrace, validateStep, REASONING_INVARIANTS,
    // Inference
    getInferenceStatus, addInferenceFact, addInferenceRule, queryWithInference,
    syllogisticReason, forwardChain,
    // Hypothesis
    ensureHypothesisEngine, proposeHypothesis, designExperiment, recordEvidence,
    evaluateHypothesis, HYPOTHESIS_INVARIANTS,
    // Metacognition
    ensureMetacognitionSystem, assessKnowledge, recordPrediction, resolvePrediction,
    getCalibrationReport, selectStrategy, introspectOnFailures, analyzeFailure,
    adaptReasoningStrategy, getIntrospectionStatus, adjustConfidenceFromLearning,
    METACOGNITION_INVARIANTS,
    // Explanation
    ensureExplanationEngine, generateExplanation, explainDtuChange, EXPLANATION_INVARIANTS,
    // Meta-learning
    ensureMetaLearningSystem, defineLearningStrategy, recordStrategyOutcome,
    adaptStrategy, generateCurriculum, getBestStrategy, META_LEARNING_INVARIANTS,
  } = deps;

  // ===== CHICKEN3: Meta-DTU helpers (additive, named per blueprint) =====
  // (generateMetaProposal and council.reviewAndCommitQuiet are passed in via deps)

  // ===== CHICKEN3 MACROS (additive) =====

  // ============================================================================
  // GA: ENTITY TERMINAL ACCESS (Governed, Sandboxed, Reality-Bounded)
  // ============================================================================

  // ACL: terminal exec is local-only and entity-scoped; approval is council-gated.
  try {
    allowMacro("entity","terminal",{ roles:["owner","admin","member"], scopes:["*"] });
    allowMacro("entity","terminal_approve",{ roles:["owner","admin","council"], scopes:["*"] });
  } catch {
    // allowMacro may not be defined yet in older builds; ignore (local-first default is open).
  }

  // ============================================================================
  // GA: SANDBOX EXECUTOR
  // ============================================================================
  function executeInSandbox({ entityId, command, workDir, timeoutMs, maxOutputBytes }) {
    // P0.1: Defense-in-depth — sandbox executor also checks the gate
    if (!TERMINAL_EXEC_ENABLED) {
      return Promise.resolve({ exitCode: 1, stdout: "", stderr: "Terminal execution is disabled.", timedOut: false });
    }
    return new Promise((resolve) => {
      const proc = spawnSync("bash", ["-c", command], {
        cwd: workDir,
        timeout: timeoutMs,
        maxBuffer: maxOutputBytes,
        env: {
          ...process.env,
          ENTITY_ID: String(entityId || ""),
          HOME: String(workDir || ""),
          PATH: process.env.PATH,
          NO_PROXY: "*",
        },
        encoding: "utf-8"
      });

      resolve({
        exitCode: proc.status || 0,
        stdout: String(proc.stdout || ""),
        stderr: String(proc.stderr || ""),
        timedOut: proc.error?.code === "ETIMEDOUT"
      });
    });
  }

  register("entity", "terminal", async (ctx, input={}) => {
    // P0.1: Hard-gate — disabled unless ENABLE_TERMINAL_EXEC=true
    if (!TERMINAL_EXEC_ENABLED) {
      return { ok: false, error: "Terminal execution is disabled. Set ENABLE_TERMINAL_EXEC=true to enable.", disabled: true };
    }

    enforceEthosInvariant("entity_terminal");

    const entityId = String(ctx?.actor?.userId || "");
    const command = String(input?.command || "").trim();
    const workingDir = String(input?.cwd || "");
    const requestId = uid("term_req");

    // Validation
    if (!entityId) return { ok:false, error:"Entity identity required" };
    if (!command) return { ok:false, error:"Command required" };
    if (entityId === "anon") return { ok:false, error:"Anonymous entities cannot execute commands" };
    if (command.length > 2000) return { ok:false, error:"Command too long (max 2000 chars)" };

    // Command injection protection - block dangerous patterns
    const dangerousPatterns = [
      /[`]/, // backtick command substitution
      /\$\(/, // $() command substitution
      /\$\{/, // ${} variable expansion with commands
      /;\s*[a-z]/i, // command chaining with semicolon
      /\|\s*[a-z]/i, // piping to commands (except simple pipes)
      /&&/, // AND chaining
      /\|\|/, // OR chaining
      />\s*\//, // redirect to absolute path
      />\s*\.\.\// , // redirect to parent path
      /\bsudo\b/i, // sudo
      /\bsu\b\s/, // su command
      /\bchmod\b.*777/, // dangerous chmod
      /\brm\b.*-rf?\s+\//, // rm -rf /
      /\bdd\b.*of=\//, // dd to device
      /\bmkfs\b/, // filesystem creation
      /\bshutdown\b/, // shutdown
      /\breboot\b/, // reboot
      /\bkill\b.*-9.*1\b/, // kill init
      /\/etc\/passwd/, // passwd file
      /\/etc\/shadow/, // shadow file
      /\.ssh\//, // ssh directory
      /\beval\b/, // eval command
      /\bexec\b/, // exec command
      /\bsource\b\s/, // source command
      /\b\.\s+\//, // . /path sourcing
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { ok:false, error:"Command contains blocked pattern", blocked: true };
      }
    }

    // Entity workspace setup
    const ENTITY_HOME = path.join(DATA_DIR, "entity_workspaces", entityId);

    // Workdir safety: prevent path traversal outside the entity home.
    const BASE = path.resolve(ENTITY_HOME);
    let workDir = BASE;
    if (workingDir) {
      const resolved = path.resolve(ENTITY_HOME, workingDir);
      const basePrefix = BASE.endsWith(path.sep) ? BASE : (BASE + path.sep);
      if (!resolved.startsWith(basePrefix)) {
        return { ok:false, error:"Invalid cwd: path escapes entity workspace" };
      }
      workDir = resolved;
    }

    // Ensure workspace exists
    try {
      fs.mkdirSync(ENTITY_HOME, { recursive: true });
      fs.mkdirSync(path.join(ENTITY_HOME, "workspace"), { recursive: true });
      fs.mkdirSync(path.join(ENTITY_HOME, "forks"), { recursive: true });
      fs.mkdirSync(path.join(ENTITY_HOME, "logs"), { recursive: true });
    } catch (e) {
      return { ok:false, error:`Workspace init failed: ${String(e?.message||e)}` };
    }

    // Parse command for classification
    const cmdLower = command.toLowerCase();
    const isGit = /^git\s/.test(cmdLower);
    const isNpm = /^npm\s/.test(cmdLower);
    const isRead = /^(ls|cat|pwd|echo|head|tail|grep|find|tree)\b/.test(cmdLower);
    const isWrite = /^(rm|mv|cp|mkdir|touch|nano|vim)\b/.test(cmdLower) || />|>>/.test(command);
    const isDeploy = /^(node\b|pm2\b|npm\s+start\b)/.test(cmdLower);

    // Risk classification
    let riskLevel = "low";
    if (isDeploy) riskLevel = "high";
    else if (isWrite || isNpm) riskLevel = "medium";
    else if (isRead || isGit) riskLevel = "low";
    else riskLevel = "medium"; // unknown commands default medium

    // Council gate for medium+ risk
    if (riskLevel === "medium" || riskLevel === "high") {
      ensureQueues();
      const proposalId = uid("proposal");
      const proposal = {
        id: proposalId,
        type: "ENTITY_TERMINAL_REQUEST",
        entityId,
        command,
        riskLevel,
        requestId,
        status: "pending",
        createdAt: nowISO(),
        votes: { approve: [], deny: [], abstain: [] },
        threshold: riskLevel === "high" ? 0.75 : 0.60 // 75% for high risk, 60% for medium
      };

      STATE.queues.terminalRequests = STATE.queues.terminalRequests || [];
      STATE.queues.terminalRequests.push(proposal);
      saveStateDebounced();

      log("entity.terminal.proposed", `Entity ${entityId} requested terminal access`, {
        proposalId,
        command: command.slice(0, 200),
        riskLevel
      });

      return {
        ok:true,
        status: "pending_council_approval",
        proposalId,
        riskLevel,
        message: `Command requires ${riskLevel} risk council approval. Proposal ${proposalId} created.`
      };
    }

    // Low risk: Chicken2 reality check only
    const c2 = inLatticeReality({
      type:"entity_terminal",
      domain:"entity",
      name:"terminal",
      input:{ command, entityId },
      ctx
    });

    if (!c2.ok) {
      log("entity.terminal.reject.c2", `Chicken2 rejected command`, {
        entityId,
        command: command.slice(0, 200),
        reason: c2.reason
      });
      return {
        ok:false,
        error:`Reality guard: ${c2.reason}`,
        severity: c2.severity
      };
    }

    // Execute in sandbox
    const result = await executeInSandbox({
      entityId,
      command,
      workDir,
      timeoutMs: 30000,
      maxOutputBytes: 2 * 1024 * 1024
    });

    // Create shadow audit DTU (best-effort; never blocks)
    try {
      const auditDTU = {
        id: uid("dtu"),
        type: "entity_terminal_audit",
        title: `Entity Terminal Exec (${entityId})`,
        tags: ["entity","terminal","audit","shadow"],
        createdAt: nowISO(),
        updatedAt: nowISO(),
        shadow: true,
        hidden: true,
        entityId,
        requestId,
        riskLevel,
        command: command.slice(0, 8000),
        result: {
          exitCode: result.exitCode,
          timedOut: !!result.timedOut,
          stdout: String(result.stdout||"").slice(0, 10000),
          stderr: String(result.stderr||"").slice(0, 10000),
          executedAt: nowISO()
        }
      };

      // Prefer native shadow DTU mechanism if present; fallback to generic set()
      if (typeof globalThis.writeShadowDTU === "function") globalThis.writeShadowDTU(auditDTU);
      else if (typeof globalThis.set === "function") globalThis.set(auditDTU.id, auditDTU);
    } catch (e) {
      log("entity.terminal.audit.failed", "Failed to create audit DTU", { error: String(e?.message||e) });
    }

    log("entity.terminal.executed", `Entity ${entityId} executed command`, {
      requestId,
      command: command.slice(0, 200),
      exitCode: result.exitCode
    });

    return {
      ok: true,
      requestId,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      executedAt: nowISO(),
      riskLevel
    };

  }, {
    summary: "Execute terminal command as entity (council-gated for medium+ risk, reality-bounded)",
    public: false
  });

  // ============================================================================
  // GA: COUNCIL APPROVAL PROCESSOR
  // ============================================================================
  register("entity", "terminal_approve", async (ctx, input={}) => {
    // P0.1: Hard-gate — disabled unless ENABLE_TERMINAL_EXEC=true
    if (!TERMINAL_EXEC_ENABLED) {
      return { ok: false, error: "Terminal execution is disabled. Set ENABLE_TERMINAL_EXEC=true to enable.", disabled: true };
    }

    enforceEthosInvariant("entity_terminal_approve");

    const proposalId = String(input?.proposalId || "");
    const vote = String(input?.vote || "").toLowerCase(); // approve | deny | abstain
    const voterId = String(ctx?.actor?.userId || "");
    const voterRole = String(ctx?.actor?.role || "viewer");

    if (!proposalId) return { ok:false, error:"proposalId required" };
    if (!["approve","deny","abstain"].includes(vote)) return { ok:false, error:"vote must be approve|deny|abstain" };

    ensureQueues();
    const proposal = (STATE.queues?.terminalRequests || []).find(p => p?.id === proposalId);
    if (!proposal) return { ok:false, error:"Proposal not found" };
    if (proposal.status !== "pending") return { ok:false, error:`Proposal already ${proposal.status}` };

    proposal.votes = proposal.votes || { approve: [], deny: [], abstain: [] };
    proposal.votes.approve = (proposal.votes.approve || []).filter(v => v.id !== voterId);
    proposal.votes.deny = (proposal.votes.deny || []).filter(v => v.id !== voterId);
    proposal.votes.abstain = (proposal.votes.abstain || []).filter(v => v.id !== voterId);

    const voteRecord = { id: voterId, role: voterRole, votedAt: nowISO() };
    if (vote === "approve") proposal.votes.approve.push(voteRecord);
    else if (vote === "deny") proposal.votes.deny.push(voteRecord);
    else proposal.votes.abstain.push(voteRecord);

    const approveCount = proposal.votes.approve.length;
    const denyCount = proposal.votes.deny.length;
    const abstainCount = proposal.votes.abstain.length;

    // Spec behavior: abstain does NOT affect approval ratio.
    const totalVotes = approveCount + denyCount + abstainCount;
    const decisiveVotes = approveCount + denyCount;
    const approvalRatio = decisiveVotes > 0 ? (approveCount / decisiveVotes) : 0;
    const threshold = Number(proposal.threshold || 0.60);

    if (totalVotes >= 3 && approvalRatio >= threshold) {
      proposal.status = "approved";
      proposal.approvedAt = nowISO();

      const execResult = await executeInSandbox({
        entityId: proposal.entityId,
        command: proposal.command,
        workDir: path.join(DATA_DIR, "entity_workspaces", proposal.entityId),
        timeoutMs: 30000,
        maxOutputBytes: 2 * 1024 * 1024
      });

      proposal.executionResult = {
        exitCode: execResult.exitCode,
        stdout: String(execResult.stdout || "").slice(0, 10000),
        stderr: String(execResult.stderr || "").slice(0, 10000),
        executedAt: nowISO()
      };

      log("entity.terminal.council_approved", `Council approved terminal command for ${proposal.entityId}`, {
        proposalId,
        command: String(proposal.command || "").slice(0, 200),
        approvalRatio,
        exitCode: execResult.exitCode
      });
    }
    else if (totalVotes >= 3 && approvalRatio < (1 - threshold)) {
      proposal.status = "denied";
      proposal.deniedAt = nowISO();

      log("entity.terminal.council_denied", `Council denied terminal command for ${proposal.entityId}`, {
        proposalId,
        command: String(proposal.command || "").slice(0, 200),
        approvalRatio
      });
    }

    saveStateDebounced();

    return {
      ok: true,
      proposalId,
      status: proposal.status,
      votes: {
        approve: approveCount,
        deny: denyCount,
        abstain: abstainCount,
        approvalRatio,
        threshold
      },
      executionResult: proposal.executionResult || null
    };
  }, {
    summary: "Vote on entity terminal request (council-gated)",
    public: false
  });


  register("chicken3","status", (ctx, _input={}) => {
    enforceEthosInvariant("status");
    return { ok:true, chicken3: ctx.state.__chicken3, enabled: Boolean(ctx.state.__chicken3?.enabled) };
  }, { public:true });

  register("chicken3","session_optin", (ctx, input={}) => {
    enforceEthosInvariant("optin");
    const sid = String(input.sessionId || input.session || "");
    if (!sid) return { ok:false, error:"sessionId required" };
    const s = ctx.state.sessions.get(sid) || { createdAt: nowISO(), messages: [] };
    // Only additive flags
    if (typeof input.cloudOptIn === "boolean") s.cloudOptIn = input.cloudOptIn;
    if (typeof input.toolsOptIn === "boolean") s.toolsOptIn = input.toolsOptIn;
    if (typeof input.multimodalOptIn === "boolean") s.multimodalOptIn = input.multimodalOptIn;
    if (typeof input.voiceOptIn === "boolean") s.voiceOptIn = input.voiceOptIn;
    ctx.state.sessions.set(sid, s);
    saveStateDebounced();
    return { ok:true, sessionId: sid, flags: { cloudOptIn: !!s.cloudOptIn, toolsOptIn: !!s.toolsOptIn, multimodalOptIn: !!s.multimodalOptIn, voiceOptIn: !!s.voiceOptIn } };
  }, { public:true });

  function _c3sessionFlags(ctx){
    const sid = String(ctx?.reqMeta?.sessionId || ctx?.reqMeta?.sid || ctx?.sessionId || ctx?.actor?.sessionId || "");
    const s = sid ? (ctx?.state?.sessions?.get?.(sid) || null) : null;
    return {
      sessionId: sid,
      cloudOptIn: Boolean(s?.cloudOptIn === true),
      toolsOptIn: Boolean(s?.toolsOptIn === true),
      multimodalOptIn: Boolean(s?.multimodalOptIn === true),
      voiceOptIn: Boolean(s?.voiceOptIn === true),
    };
  }

  register("chicken3","meta_propose", (ctx, input={}) => {
    // Blueprint name: generateMetaProposal
    return generateMetaProposal(ctx, input);
  }, { public:false });

  register("chicken3","meta_commit_quiet", (ctx, input={}) => {
    // Blueprint name: council.reviewAndCommitQuiet
    return council.reviewAndCommitQuiet(ctx, input);
  }, { public:false });

  register("multimodal","vision_analyze", (ctx, input={}) => {
    enforceEthosInvariant("analyze_image");
    const flags = _c3sessionFlags(ctx);
    if (!ctx.state.__chicken3?.multimodalEnabled) return { ok:false, error:"multimodal disabled" };
    if (!flags.multimodalOptIn) return { ok:false, error:"session multimodal opt-in required" };

    const imageB64 = String(input.imageBase64 || "");
    const prompt = String(input.prompt || "Analyze this image in detail.");
    if (!imageB64) return { ok:false, error:"imageBase64 required" };

    // Governed execution: all external/tool-like calls route through governedCall.
    return governedCall(ctx, "multimodal.vision_analyze", async () => {

    // Local-first: Ollama (llava) if configured
    const OLLAMA_URL = process.env.OLLAMA_URL || process.env.OLLAMA_HOST || "";
    if (OLLAMA_URL) {
      const model = String(process.env.OLLAMA_VISION_MODEL || "llava");
      const payload = {
        model,
        messages: [{ role:"user", content: prompt, images: [imageB64] }]
      };
      try {
        const r = await BREAKERS.ollama.call(() =>
          fetch(`${OLLAMA_URL}/api/chat`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) })
        );
        if (r && r.ok) {
          const j = await r.json().catch(()=>null);
          const content = j?.message?.content || j?.response || "";
          return { ok:true, content, source: "ollama_llava" };
        }
      } catch (e) {
        structuredLog("warn", "ollama_call_failed", { error: String(e?.message || e), circuit: BREAKERS.ollama.getState().state });
      }
    }

    // Cloud fallback: OpenAI GPT-4 Vision
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    if (OPENAI_API_KEY) {
      const payload = {
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageB64}` } }
          ]
        }],
        max_tokens: 1000
      };

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).catch(_e => null);

      if (!r || !r.ok) {
        const errText = await r?.text().catch(() => "") || "";
        return { ok:false, error:"OpenAI Vision API failed", status: r?.status || 0, detail: errText };
      }
      const j = await r.json().catch(() => null);
      const content = j?.choices?.[0]?.message?.content || "";
      return { ok:true, content, source: "openai_gpt4_vision" };
    }

    return { ok:false, error:"No vision backend configured. Set OLLAMA_URL or OPENAI_API_KEY" };
    });
  }, { public:false });

  register("multimodal","image_generate", (ctx, input={}) => {
    enforceEthosInvariant("generate_image");
    const flags = _c3sessionFlags(ctx);
    if (!ctx.state.__chicken3?.multimodalEnabled) return { ok:false, error:"multimodal disabled" };
    if (!flags.multimodalOptIn) return { ok:false, error:"session multimodal opt-in required" };

    const prompt = String(input.prompt || "");
    if (!prompt) return { ok:false, error:"prompt required" };

    return governedCall(ctx, "multimodal.image_generate", async () => {

    // Local-first: Stable Diffusion / ComfyUI HTTP if configured
    const SD_URL = process.env.SD_URL || process.env.COMFYUI_URL || process.env.A1111_URL || "";
    if (SD_URL) {
      const body = { prompt, steps: clamp(Number(input.steps || 30), 5, 80) };
      const r = await fetch(SD_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body) }).catch(_e=>null);
      if (r && r.ok) {
        const j = await r.json().catch(()=>null);
        const img = j?.images?.[0] || j?.image || j?.data?.[0] || null;
        return { ok:true, image: img, source: "stable_diffusion", raw: j };
      }
    }

    // Cloud fallback: OpenAI DALL-E
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    if (OPENAI_API_KEY) {
      const size = String(input.size || "1024x1024"); // 1024x1024, 1792x1024, 1024x1792
      const quality = String(input.quality || "standard"); // standard, hd
      const model = String(input.model || "dall-e-3");

      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          quality,
          response_format: "b64_json"
        })
      }).catch(_e => null);

      if (!r || !r.ok) {
        const errText = await r?.text().catch(() => "") || "";
        return { ok:false, error:"OpenAI DALL-E API failed", status: r?.status || 0, detail: errText };
      }
      const j = await r.json().catch(() => null);
      const imageB64 = j?.data?.[0]?.b64_json || "";
      const revisedPrompt = j?.data?.[0]?.revised_prompt || prompt;
      return { ok:true, image: imageB64, source: "openai_dalle", revisedPrompt };
    }

    return { ok:false, error:"No image generation backend configured. Set SD_URL or OPENAI_API_KEY" };
    });
  }, { public:false });

  register("voice","transcribe", async (ctx, input={}) => {
    enforceEthosInvariant("transcribe_audio");
    const flags = _c3sessionFlags(ctx);
    if (!ctx.state.__chicken3?.voiceEnabled) return { ok:false, error:"voice disabled" };
    if (!flags.voiceOptIn) return { ok:false, error:"session voice opt-in required" };

    // Local-first: whisper.cpp binary
    const bin = process.env.WHISPER_CPP_BIN || "";
    if (bin) {
      const audioPath = String(input.audioPath || "");
      if (!audioPath) return { ok:false, error:"audioPath required (server-side file path)" };
      const args = [ "-f", audioPath, "--output-txt" ];
      const p = spawnSync(bin, args, { encoding:"utf-8" });
      if (p.error) return { ok:false, error:String(p.error) };
      const out = (p.stdout || "") + (p.stderr || "");
      return { ok:true, transcript: out.trim(), source: "whisper_cpp" };
    }

    // Cloud fallback: OpenAI Whisper API
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    if (OPENAI_API_KEY) {
      const audioBase64 = String(input.audioBase64 || "");
      const audioPath = String(input.audioPath || "");
      let audioBuffer = null;

      if (audioBase64) {
        audioBuffer = Buffer.from(audioBase64, "base64");
      } else if (audioPath && fs.existsSync(audioPath)) {
        audioBuffer = fs.readFileSync(audioPath);
      }

      if (!audioBuffer) return { ok:false, error:"audioBase64 or valid audioPath required" };

      const FormData = (await import("node:buffer")).Blob ? globalThis.FormData : null;
      if (!FormData) {
        // Node 18+ has native FormData, use fetch with multipart
        const boundary = `----formdata-${Date.now()}`;
        const filename = "audio.webm";
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`),
          audioBuffer,
          Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}--\r\n`)
        ]);

        const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`
          },
          body
        }).catch(_e => null);

        if (!r || !r.ok) {
          const errText = await r?.text().catch(() => "") || "";
          return { ok:false, error:"OpenAI Whisper API failed", status: r?.status || 0, detail: errText };
        }
        const j = await r.json().catch(() => null);
        return { ok:true, transcript: j?.text || "", source: "openai_whisper" };
      }
    }

    return { ok:false, error:"No transcription backend configured. Set WHISPER_CPP_BIN or OPENAI_API_KEY" };
  }, { public:false });

  register("voice","tts", async (ctx, input={}) => {
    enforceEthosInvariant("synthesize_speech");
    const flags = _c3sessionFlags(ctx);
    if (!ctx.state.__chicken3?.voiceEnabled) return { ok:false, error:"voice disabled" };
    if (!flags.voiceOptIn) return { ok:false, error:"session voice opt-in required" };

    const text = String(input.text || "");
    if (!text) return { ok:false, error:"text required" };

    // Local-first: Piper binary
    const bin = process.env.PIPER_BIN || "";
    if (bin) {
      const voice = String(process.env.PIPER_VOICE || "");
      const args = voice ? ["--model", voice] : [];
      const p = spawnSync(bin, args, { input: text, encoding:"utf-8" });
      if (p.error) return { ok:false, error:String(p.error) };
      const outPath = String(input.outPath || "");
      if (outPath) {
        // Path traversal protection - only allow writes to entity workspace or tmp
        const TTS_OUTPUT_DIR = path.join(DATA_DIR, "tts_output");
        try { fs.mkdirSync(TTS_OUTPUT_DIR, { recursive: true }); } catch {}
        const safeName = path.basename(outPath).replace(/[^a-zA-Z0-9._-]/g, "_");
        const safePath = path.join(TTS_OUTPUT_DIR, safeName);
        try { fs.writeFileSync(safePath, p.stdout); } catch {}
        return { ok:true, outPath: safePath, source: "piper", note:"TTS wrote audio to safe path." };
      }
      return { ok:true, source: "piper", audioBase64: Buffer.from(p.stdout).toString("base64") };
    }

    // Cloud fallback: OpenAI TTS API
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    if (OPENAI_API_KEY) {
      const voice = String(input.voice || "alloy"); // alloy, echo, fable, onyx, nova, shimmer
      const model = String(input.model || "tts-1"); // tts-1 or tts-1-hd

      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, input: text, voice, response_format: "mp3" })
      }).catch(_e => null);

      if (!r || !r.ok) {
        const errText = await r?.text().catch(() => "") || "";
        return { ok:false, error:"OpenAI TTS API failed", status: r?.status || 0, detail: errText };
      }

      const audioBuffer = Buffer.from(await r.arrayBuffer());
      const outPath = String(input.outPath || "");
      if (outPath) {
        try { fs.writeFileSync(outPath, audioBuffer); } catch {}
        return { ok:true, outPath, source: "openai_tts", format: "mp3" };
      }
      return { ok:true, source: "openai_tts", format: "mp3", audioBase64: audioBuffer.toString("base64") };
    }

    return { ok:false, error:"No TTS backend configured. Set PIPER_BIN or OPENAI_API_KEY" };
  }, { public:false });

  register("tools","web_search", (ctx, input={}) => {
    enforceEthosInvariant("web_search");
    const flags = _c3sessionFlags(ctx);
    if (!ctx.state.__chicken3?.toolsEnabled) return { ok:false, error:"tools disabled" };
    if (!flags.toolsOptIn) return { ok:false, error:"session tools opt-in required" };

    // Governed call: even local-first external network calls are considered effectful tools.
    return governedCall(ctx, "tools.web_search", async () => {

    const q = String(input.query || input.q || "");
    if (!q) return { ok:false, error:"query required" };

    // Local-first default: DuckDuckGo HTML (no API key). If you run SearxNG locally, set SEARXNG_URL.
    const local = process.env.SEARXNG_URL || "";
    const url = local ? `${local}/search?q=${encodeURIComponent(q)}&format=json` : `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { method:"GET" }).catch(_e=>null);
    if (!r || !r.ok) return { ok:false, error:"search failed", status: r?.status || 0 };

    const text = await r.text().catch(()=> "");

    // Optional cloud path: if user has explicitly opted in, allow downstream summarization via LLM.
    // (We do NOT require cloud for search; this is for post-processing convenience only.)
    let summary = null;
    const wantSummary = Boolean(input.summarize);
    if (wantSummary && flags.cloudOptIn && _cloudOptInAllowed({ sessionId: ctx?.sessionId })) {
      try {
        const sctx = { ...ctx, _background: true };
        const s = await runMacro("chat","respond", { mode:"ask", sessionId: ctx?.sessionId, prompt: `Summarize these search results for: ${q}\n\n${text.slice(0, 8000)}` }, sctx).catch(()=>null);
        summary = s?.answer ?? s?.content ?? s?.text ?? null;
      } catch {}
    }

    return { ok:true, source: local ? "searxng" : "duckduckgo_html", text: text.slice(0, 200000), summary };
    });
  }, { public:false });

  // ===== END CHICKEN3 MACROS =====

  // ===== GOAL SYSTEM MACROS =====

  register("goals", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("goals_status");
    ensureGoalSystem();

    const activeGoals = Array.from(ctx.state.goals.active)
      .map(id => ctx.state.goals.registry.get(id))
      .filter(Boolean)
      .map(g => ({
        id: g.id,
        title: g.title,
        type: g.type,
        progress: g.progress.current / g.progress.target,
        priority: g.priority,
        startedAt: g.progress.startedAt
      }));

    const proposalCount = ctx.state.queues.goalProposals?.length || 0;

    return {
      ok: true,
      active: activeGoals,
      activeCount: activeGoals.length,
      proposalCount,
      stats: ctx.state.goals.stats,
      config: ctx.state.goals.config,
      invariants: GOAL_INVARIANTS
    };
  }, { public: true });

  register("goals", "propose", (ctx, input = {}) => {
    enforceEthosInvariant("goals_propose");
    ensureGoalSystem();

    const result = createGoalProposal({
      title: input.title,
      description: input.description,
      type: input.type || "exploration",
      priority: input.priority,
      source: input.source || "user",
      tags: input.tags,
      requiredDtus: input.requiredDtus,
      requiredGoals: input.requiredGoals,
      target: input.target
    });

    if (!result.ok) return result;

    const goal = result.goal;
    ctx.state.goals.registry.set(goal.id, goal);
    ctx.state.queues.goalProposals.push({ id: goal.id, createdAt: goal.createdAt });
    ctx.state.goals.stats.proposed++;

    saveStateDebounced();
    return { ok: true, goal: { id: goal.id, title: goal.title, type: goal.type, state: goal.state } };
  }, { public: false });

  register("goals", "evaluate", (ctx, input = {}) => {
    enforceEthosInvariant("goals_evaluate");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const goal = ctx.state.goals.registry.get(goalId);
    if (!goal) return { ok: false, error: "Goal not found" };

    const result = evaluateGoal(goal, ctx);
    if (result.ok) {
      ctx.state.goals.registry.set(goalId, result.goal);
      saveStateDebounced();
    }

    return {
      ok: result.ok,
      evaluation: result.goal?.evaluation,
      state: result.goal?.state,
      passed: result.passed,
      error: result.error
    };
  }, { public: false });

  register("goals", "approve", (ctx, input = {}) => {
    enforceEthosInvariant("goals_approve");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const goal = ctx.state.goals.registry.get(goalId);
    if (!goal) return { ok: false, error: "Goal not found" };

    if (!["owner", "admin", "founder"].includes(ctx.actor?.role)) {
      return { ok: false, error: "Founder approval requires owner/admin role" };
    }

    goal.meta.founderApproved = true;
    goal.meta.approvedBy = ctx.actor?.userId || "unknown";
    goal.meta.approvedAt = nowISO();
    goal.state = GOAL_STATES.APPROVED;
    goal.updatedAt = nowISO();

    ctx.state.goals.stats.approved++;
    saveStateDebounced();

    return { ok: true, goal: { id: goal.id, title: goal.title, state: goal.state, founderApproved: true } };
  }, { public: false });

  register("goals", "activate", (ctx, input = {}) => {
    enforceEthosInvariant("goals_activate");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const result = activateGoal(goalId);
    if (result.ok) saveStateDebounced();

    return {
      ok: result.ok,
      goal: result.goal ? { id: result.goal.id, title: result.goal.title, state: result.goal.state } : null,
      error: result.error
    };
  }, { public: false });

  register("goals", "progress", (ctx, input = {}) => {
    enforceEthosInvariant("goals_progress");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const delta = Number(input.delta || input.progress || 1);
    const milestone = input.milestone || null;

    const result = updateGoalProgress(goalId, delta, milestone);
    return {
      ok: result.ok,
      progress: result.progress,
      completed: result.completed || false,
      error: result.error
    };
  }, { public: false });

  register("goals", "complete", (ctx, input = {}) => {
    enforceEthosInvariant("goals_complete");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    return completeGoal(goalId);
  }, { public: false });

  register("goals", "abandon", (ctx, input = {}) => {
    enforceEthosInvariant("goals_abandon");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const reason = String(input.reason || "user_requested");
    return abandonGoal(goalId, reason);
  }, { public: false });

  register("goals", "list", (ctx, input = {}) => {
    enforceEthosInvariant("goals_list");
    ensureGoalSystem();

    const state = input.state;
    const type = input.type;
    const limit = clamp(Number(input.limit || 50), 1, 200);

    let goals = Array.from(ctx.state.goals.registry.values());

    if (state) goals = goals.filter(g => g.state === state);
    if (type) goals = goals.filter(g => g.type === type);

    goals = goals
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(g => ({
        id: g.id,
        title: g.title,
        type: g.type,
        state: g.state,
        priority: g.priority,
        progress: g.progress.current / g.progress.target,
        source: g.source,
        createdAt: g.createdAt
      }));

    return { ok: true, goals, total: ctx.state.goals.registry.size };
  }, { public: true });

  register("goals", "get", (ctx, input = {}) => {
    enforceEthosInvariant("goals_get");
    ensureGoalSystem();

    const goalId = String(input.goalId || input.id || "");
    if (!goalId) return { ok: false, error: "goalId required" };

    const goal = ctx.state.goals.registry.get(goalId);
    if (!goal) return { ok: false, error: "Goal not found" };

    return { ok: true, goal };
  }, { public: true });

  register("goals", "auto_propose", (ctx, _input = {}) => {
    enforceEthosInvariant("goals_auto_propose");
    return generateAutoGoalProposals(ctx);
  }, { public: false });

  register("goals", "config", (ctx, input = {}) => {
    enforceEthosInvariant("goals_config");
    ensureGoalSystem();

    if (!["owner", "admin", "founder"].includes(ctx.actor?.role)) {
      return { ok: true, config: ctx.state.goals.config, readonly: true };
    }

    if (typeof input.maxActiveGoals === "number") {
      ctx.state.goals.config.maxActiveGoals = clamp(input.maxActiveGoals, 1, 20);
    }
    if (typeof input.evaluationThreshold === "number") {
      ctx.state.goals.config.evaluationThreshold = clamp(input.evaluationThreshold, 0.1, 0.95);
    }
    if (typeof input.autoProposalEnabled === "boolean") {
      ctx.state.goals.config.autoProposalEnabled = input.autoProposalEnabled;
    }
    if (typeof input.founderApprovalRequired === "boolean") {
      ctx.state.goals.config.founderApprovalRequired = input.founderApprovalRequired;
    }

    saveStateDebounced();
    return { ok: true, config: ctx.state.goals.config };
  }, { public: false });

  // ===== END GOAL SYSTEM MACROS =====

  // ===== WORLD MODEL MACROS =====

  register("worldmodel", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("worldmodel_status");
    ensureWorldModel();
    return {
      ok: true,
      entities: ctx.state.worldModel.entities.size,
      relations: ctx.state.worldModel.relations.size,
      simulations: ctx.state.worldModel.simulations.size,
      snapshots: ctx.state.worldModel.snapshots.length,
      stats: ctx.state.worldModel.stats,
      config: ctx.state.worldModel.config,
      invariants: WORLD_MODEL_INVARIANTS
    };
  }, { public: true });

  register("worldmodel", "create_entity", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_create_entity");
    return createWorldEntity(input);
  }, { public: false });

  register("worldmodel", "create_relation", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_create_relation");
    return createWorldRelation(input);
  }, { public: false });

  register("worldmodel", "get_entity", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_get_entity");
    ensureWorldModel();
    const entityId = String(input.entityId || input.id || "");
    if (!entityId) return { ok: false, error: "entityId required" };
    const includeRelations = input.includeRelations !== false;
    if (includeRelations) return getEntityWithRelations(entityId);
    const entity = ctx.state.worldModel.entities.get(entityId);
    if (!entity) return { ok: false, error: "Entity not found" };
    return { ok: true, entity };
  }, { public: true });

  register("worldmodel", "list_entities", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_list_entities");
    ensureWorldModel();
    const type = input.type;
    const limit = clamp(Number(input.limit || 100), 1, 500);
    const search = String(input.search || "").toLowerCase();
    let entities = Array.from(ctx.state.worldModel.entities.values());
    if (type) entities = entities.filter(e => e.type === type);
    if (search) {entities = entities.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.description.toLowerCase().includes(search)
    );}
    entities = entities
      .sort((a, b) => b.state.salience - a.state.salience)
      .slice(0, limit)
      .map(e => ({
        id: e.id, name: e.name, type: e.type, salience: e.state.salience,
        confidence: e.state.confidence, relationCount: e.relationCount, createdAt: e.createdAt
      }));
    return { ok: true, entities, total: ctx.state.worldModel.entities.size };
  }, { public: true });

  register("worldmodel", "list_relations", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_list_relations");
    ensureWorldModel();
    const entityId = input.entityId;
    const type = input.type;
    const limit = clamp(Number(input.limit || 100), 1, 500);
    let relations = Array.from(ctx.state.worldModel.relations.values());
    if (entityId) relations = relations.filter(r => r.from === entityId || r.to === entityId);
    if (type) relations = relations.filter(r => r.type === type);
    relations = relations
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map(r => ({ id: r.id, from: r.from, to: r.to, type: r.type, strength: r.strength, confidence: r.confidence }));
    return { ok: true, relations, total: ctx.state.worldModel.relations.size };
  }, { public: true });

  register("worldmodel", "simulate", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_simulate");
    return runWorldSimulation(input);
  }, { public: false });

  register("worldmodel", "counterfactual", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_counterfactual");
    return generateCounterfactual(input);
  }, { public: false });

  register("worldmodel", "get_simulation", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_get_simulation");
    ensureWorldModel();
    const simId = String(input.simId || input.id || "");
    if (!simId) return { ok: false, error: "simId required" };
    const sim = ctx.state.worldModel.simulations.get(simId);
    if (!sim) return { ok: false, error: "Simulation not found" };
    return { ok: true, simulation: sim };
  }, { public: true });

  register("worldmodel", "list_simulations", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_list_simulations");
    ensureWorldModel();
    const limit = clamp(Number(input.limit || 20), 1, 100);
    const simulations = Array.from(ctx.state.worldModel.simulations.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map(s => ({
        id: s.id, type: s.type, status: s.status, hypothesis: s.config.hypothesis,
        insightCount: s.insights.length, createdAt: s.createdAt, completedAt: s.completedAt
      }));
    return { ok: true, simulations, total: ctx.state.worldModel.simulations.size };
  }, { public: true });

  register("worldmodel", "snapshot", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_snapshot");
    return takeWorldSnapshot(input.label);
  }, { public: false });

  register("worldmodel", "list_snapshots", (ctx, _input = {}) => {
    enforceEthosInvariant("worldmodel_list_snapshots");
    ensureWorldModel();
    const snapshots = ctx.state.worldModel.snapshots.map(s => ({
      id: s.id, label: s.label, entityCount: s.entityCount,
      relationCount: s.relationCount, takenAt: s.takenAt
    }));
    return { ok: true, snapshots };
  }, { public: true });

  register("worldmodel", "extract_from_dtu", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_extract");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    const dtu = ctx.state.dtus.get(dtuId);
    if (!dtu) return { ok: false, error: "DTU not found" };
    return extractEntitiesFromDtu(dtu);
  }, { public: false });

  register("worldmodel", "config", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_config");
    ensureWorldModel();
    if (!["owner", "admin", "founder"].includes(ctx.actor?.role)) {
      return { ok: true, config: ctx.state.worldModel.config, readonly: true };
    }
    if (typeof input.maxEntities === "number") ctx.state.worldModel.config.maxEntities = clamp(input.maxEntities, 100, 100000);
    if (typeof input.maxSimulationSteps === "number") ctx.state.worldModel.config.maxSimulationSteps = clamp(input.maxSimulationSteps, 5, 100);
    if (typeof input.autoExtractEnabled === "boolean") ctx.state.worldModel.config.autoExtractEnabled = input.autoExtractEnabled;
    saveStateDebounced();
    return { ok: true, config: ctx.state.worldModel.config };
  }, { public: false });

  register("worldmodel", "update_entity", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_update_entity");
    ensureWorldModel();
    const entityId = String(input.entityId || input.id || "");
    if (!entityId) return { ok: false, error: "entityId required" };
    const entity = ctx.state.worldModel.entities.get(entityId);
    if (!entity) return { ok: false, error: "Entity not found" };
    if (input.name) entity.name = String(input.name).slice(0, 200);
    if (input.description) entity.description = String(input.description).slice(0, 2000);
    if (typeof input.confidence === "number") entity.state.confidence = clamp(input.confidence, 0, 1);
    if (typeof input.salience === "number") entity.state.salience = clamp(input.salience, 0, 1);
    if (typeof input.volatility === "number") entity.state.volatility = clamp(input.volatility, 0, 1);
    if (input.properties && typeof input.properties === "object") {
      entity.state.properties = { ...entity.state.properties, ...input.properties };
    }
    entity.updatedAt = nowISO();
    saveStateDebounced();
    return { ok: true, entity };
  }, { public: false });

  register("worldmodel", "delete_entity", (ctx, input = {}) => {
    enforceEthosInvariant("worldmodel_delete_entity");
    ensureWorldModel();
    const entityId = String(input.entityId || input.id || "");
    if (!entityId) return { ok: false, error: "entityId required" };
    const entity = ctx.state.worldModel.entities.get(entityId);
    if (!entity) return { ok: false, error: "Entity not found" };
    const relationsToDelete = Array.from(ctx.state.worldModel.relations.entries())
      .filter(([_, r]) => r.from === entityId || r.to === entityId)
      .map(([id]) => id);
    for (const relId of relationsToDelete) ctx.state.worldModel.relations.delete(relId);
    ctx.state.worldModel.entities.delete(entityId);
    saveStateDebounced();
    return { ok: true, deleted: entityId, relationsRemoved: relationsToDelete.length };
  }, { public: false });

  // ===== SEMANTIC UNDERSTANDING MACROS =====

  register("semantic", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("semantic_status");
    ensureSemanticEngine();
    return {
      ok: true, embeddings: ctx.state.semantic.embeddings.size,
      vocabularySize: ctx.state.semantic.vocabulary.size,
      stats: ctx.state.semantic.stats, config: ctx.state.semantic.config,
      invariants: SEMANTIC_INVARIANTS
    };
  }, { public: true });

  register("semantic", "similar", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_similar");
    const query = String(input.query || "");
    if (!query) return { ok: false, error: "query required" };
    const limit = clamp(Number(input.limit || 10), 1, 50);
    const results = findSimilarDtus(query, limit, input.threshold);
    return { ok: true, results, query };
  }, { public: true });

  register("semantic", "embed", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_embed");
    const text = String(input.text || "");
    if (!text) return { ok: false, error: "text required" };
    const embedding = computeLocalEmbedding(text);
    return { ok: true, embedding, dimension: embedding.length };
  }, { public: true });

  register("semantic", "classify_intent", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_classify");
    const text = String(input.text || "");
    if (!text) return { ok: false, error: "text required" };
    return { ok: true, ...classifySemanticIntent(text) };
  }, { public: true });

  register("semantic", "extract_entities", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_extract");
    const text = String(input.text || "");
    if (!text) return { ok: false, error: "text required" };
    return { ok: true, entities: extractEntities(text) };
  }, { public: true });

  register("semantic", "semantic_roles", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_roles");
    const text = String(input.text || "");
    if (!text) return { ok: false, error: "text required" };
    return { ok: true, roles: extractSemanticRoles(text) };
  }, { public: true });

  register("semantic", "compare", (ctx, input = {}) => {
    enforceEthosInvariant("semantic_compare");
    const text1 = String(input.text1 || input.a || "");
    const text2 = String(input.text2 || input.b || "");
    if (!text1 || !text2) return { ok: false, error: "text1 and text2 required" };
    const emb1 = computeLocalEmbedding(text1);
    const emb2 = computeLocalEmbedding(text2);
    const similarity = cosineSimilarity(emb1, emb2);
    return { ok: true, similarity, interpretation: similarity > 0.8 ? "very similar" : similarity > 0.6 ? "related" : similarity > 0.4 ? "somewhat related" : "different" };
  }, { public: true });

  // ===== TRANSFER LEARNING MACROS =====

  register("transfer", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("transfer_status");
    ensureTransferEngine();
    return {
      ok: true, patterns: ctx.state.transfer.patterns.size,
      domainMappings: ctx.state.transfer.domainMappings.size,
      transfers: ctx.state.transfer.transfers.length,
      stats: ctx.state.transfer.stats, config: ctx.state.transfer.config,
      invariants: TRANSFER_INVARIANTS
    };
  }, { public: true });

  register("transfer", "classify_domain", (ctx, input = {}) => {
    enforceEthosInvariant("transfer_classify");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    const dtu = ctx.state.dtus?.get(dtuId);
    if (!dtu) return { ok: false, error: "DTU not found" };
    return { ok: true, dtuId, domain: classifyDomain(dtu) };
  }, { public: true });

  register("transfer", "extract_pattern", (ctx, input = {}) => {
    enforceEthosInvariant("transfer_extract");
    const dtuIds = input.dtuIds;
    if (!Array.isArray(dtuIds) || dtuIds.length === 0) return { ok: false, error: "dtuIds array required" };
    return extractPattern(dtuIds, input.name);
  }, { public: false });

  register("transfer", "list_patterns", (ctx, _input = {}) => {
    enforceEthosInvariant("transfer_list");
    ensureTransferEngine();
    const patterns = Array.from(ctx.state.transfer.patterns.values())
      .map(p => ({ id: p.id, name: p.name, sourceDomain: p.sourceDomain, confidence: p.confidence, dtuCount: p.structure.dtuCount }));
    return { ok: true, patterns };
  }, { public: true });

  register("transfer", "find_analogies", (ctx, input = {}) => {
    enforceEthosInvariant("transfer_analogies");
    const targetDomain = String(input.domain || "general");
    const query = String(input.query || "");
    return { ok: true, results: findAnalogousPatterns(targetDomain, query) };
  }, { public: true });

  register("transfer", "apply_pattern", (ctx, input = {}) => {
    enforceEthosInvariant("transfer_apply");
    const patternId = String(input.patternId || "");
    const targetDomain = String(input.targetDomain || "");
    if (!patternId) return { ok: false, error: "patternId required" };
    if (!targetDomain) return { ok: false, error: "targetDomain required" };
    return applyPatternToTarget(patternId, targetDomain, input.context);
  }, { public: false });

  register("transfer", "list_transfers", (ctx, _input = {}) => {
    enforceEthosInvariant("transfer_list_transfers");
    ensureTransferEngine();
    const transfers = ctx.state.transfer.transfers.slice(-50).map(t => ({
      id: t.id, sourceDomain: t.sourceDomain, targetDomain: t.targetDomain,
      confidence: t.confidence, status: t.status, createdAt: t.createdAt
    }));
    return { ok: true, transfers };
  }, { public: true });

  // ===== EXPERIENCE LEARNING MACROS =====

  register("experience", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("experience_status");
    ensureExperienceLearning();
    const el = ctx.state.experienceLearning;
    return { ok: true, episodes: el.episodes.length, patterns: el.patterns.size, strategies: el.strategies.size, stats: el.stats, config: el.config };
  }, { public: true });

  register("experience", "retrieve", (ctx, input = {}) => {
    enforceEthosInvariant("experience_retrieve");
    return { ok: true, ...retrieveExperience(String(input.domain || "general"), String(input.topic || ""), Array.isArray(input.keywords) ? input.keywords : []) };
  }, { public: true });

  register("experience", "patterns", (ctx, input = {}) => {
    enforceEthosInvariant("experience_patterns");
    ensureExperienceLearning();
    const patterns = Array.from(ctx.state.experienceLearning.patterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, Number(input.limit || 50))
      .map(p => ({ id: p.id, domain: p.domain, bestStrategy: p.bestStrategy, confidence: p.confidence, episodeCount: p.episodeCount, keywords: p.keywords }));
    return { ok: true, patterns };
  }, { public: true });

  register("experience", "consolidate", (ctx, _input = {}) => {
    enforceEthosInvariant("experience_consolidate");
    consolidateExperience();
    return { ok: true, message: "Experience consolidated" };
  }, { public: false });

  register("experience", "strategies", (ctx, input = {}) => {
    enforceEthosInvariant("experience_strategies");
    ensureExperienceLearning();
    const strategies = Array.from(ctx.state.experienceLearning.strategies.values())
      .sort((a, b) => b.avgQuality - a.avgQuality).slice(0, Number(input.limit || 50));
    return { ok: true, strategies };
  }, { public: true });

  register("experience", "recent", (ctx, input = {}) => {
    enforceEthosInvariant("experience_recent");
    ensureExperienceLearning();
    const limit = clamp(Number(input.limit || 20), 1, 100);
    return { ok: true, episodes: ctx.state.experienceLearning.episodes.slice(-limit).reverse() };
  }, { public: true });

  // ===== ATTENTION MANAGEMENT MACROS =====

  register("attention", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("attention_status");
    ensureAttentionManager();
    const attn = ctx.state.attention;
    const activeThreads = Array.from(attn.threads.values()).filter(t => t.status === "active");
    return {
      ok: true, focus: attn.focus,
      activeThreads: activeThreads.map(t => ({ id: t.id, type: t.type, priority: t.priority, description: t.description })),
      queueLength: attn.queue.length,
      backgroundTasks: attn.background.filter(t => t.status === "pending").length,
      stats: attn.stats, config: attn.config
    };
  }, { public: true });

  register("attention", "create_thread", (ctx, input = {}) => {
    enforceEthosInvariant("attention_create");
    return createCognitiveThread(input);
  }, { public: false });

  register("attention", "complete_thread", (ctx, input = {}) => {
    enforceEthosInvariant("attention_complete");
    const threadId = String(input.threadId || input.id || "");
    if (!threadId) return { ok: false, error: "threadId required" };
    return completeCognitiveThread(threadId, input.output || {});
  }, { public: false });

  register("attention", "list_threads", (ctx, _input = {}) => {
    enforceEthosInvariant("attention_list");
    ensureAttentionManager();
    const threads = Array.from(ctx.state.attention.threads.values())
      .sort((a, b) => b.priority - a.priority)
      .map(t => ({ id: t.id, type: t.type, priority: t.priority, status: t.status, description: t.description, createdAt: t.createdAt }));
    return { ok: true, threads };
  }, { public: true });

  register("attention", "queue", (ctx, _input = {}) => {
    enforceEthosInvariant("attention_queue");
    ensureAttentionManager();
    return { ok: true, queue: ctx.state.attention.queue, completed: ctx.state.attention.completed.slice(-10) };
  }, { public: true });

  register("attention", "add_background", (ctx, input = {}) => {
    enforceEthosInvariant("attention_background");
    return addBackgroundTask(input);
  }, { public: false });

  // ===== REFLECTION ENGINE MACROS =====

  register("reflection", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("reflection_status");
    ensureReflectionEngine();
    const ref = ctx.state.reflection;
    return { ok: true, reflections: ref.reflections.length, insights: ref.insights.size, selfModel: ref.selfModel, stats: ref.stats, config: ref.config };
  }, { public: true });

  register("reflection", "recent", (ctx, input = {}) => {
    enforceEthosInvariant("reflection_recent");
    ensureReflectionEngine();
    const limit = clamp(Number(input.limit || 10), 1, 50);
    const reflections = ctx.state.reflection.reflections.slice(-limit).reverse()
      .map(r => ({ id: r.id, timestamp: r.timestamp, quality: r.quality, checks: r.checks, insights: r.insights, corrections: r.corrections }));
    return { ok: true, reflections };
  }, { public: true });

  register("reflection", "self_model", (ctx, _input = {}) => {
    enforceEthosInvariant("reflection_self_model");
    ensureReflectionEngine();
    return { ok: true, selfModel: ctx.state.reflection.selfModel };
  }, { public: true });

  register("reflection", "insights", (ctx, _input = {}) => {
    enforceEthosInvariant("reflection_insights");
    ensureReflectionEngine();
    return { ok: true, insights: Array.from(ctx.state.reflection.insights.values()).slice(-50) };
  }, { public: true });

  register("reflection", "reflect_now", (ctx, input = {}) => {
    enforceEthosInvariant("reflection_manual");
    const result = reflectOnResponse({
      prompt: String(input.prompt || ""), response: String(input.response || ""),
      mode: input.mode || "explore", domain: input.domain || "general",
      llmUsed: !!input.llmUsed, relevantDtus: input.relevantDtus || []
    });
    return { ok: true, reflection: result };
  }, { public: false });

  // ===== COMMONSENSE MACROS =====

  register("commonsense", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("commonsense_status");
    ensureCommonsenseSubstrate();
    return {
      ok: true, facts: ctx.state.commonsense.facts.size,
      categories: Object.fromEntries(Object.entries(ctx.state.commonsense.categories).map(([k, v]) => [k, v.length])),
      assumptions: ctx.state.commonsense.assumptions.size,
      stats: ctx.state.commonsense.stats, invariants: COMMONSENSE_INVARIANTS
    };
  }, { public: true });

  register("commonsense", "query", (ctx, input = {}) => {
    enforceEthosInvariant("commonsense_query");
    return { ok: true, results: queryCommonsense(String(input.query || ""), input.category), query: String(input.query || "") };
  }, { public: true });

  register("commonsense", "add_fact", (ctx, input = {}) => {
    enforceEthosInvariant("commonsense_add");
    return addCommonsenseFact(input);
  }, { public: false });

  register("commonsense", "surface_assumptions", (ctx, input = {}) => {
    enforceEthosInvariant("commonsense_surface");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    return surfaceAssumptions(dtuId);
  }, { public: true });

  register("commonsense", "list_facts", (ctx, input = {}) => {
    enforceEthosInvariant("commonsense_list");
    ensureCommonsenseSubstrate();
    const category = input.category;
    let facts = Array.from(ctx.state.commonsense.facts.values());
    if (category) facts = facts.filter(f => f.category === category);
    facts = facts.slice(0, 100).map(f => ({ id: f.id, fact: f.fact, category: f.category, confidence: f.confidence }));
    return { ok: true, facts };
  }, { public: true });

  register("commonsense", "get_assumptions", (ctx, input = {}) => {
    enforceEthosInvariant("commonsense_assumptions");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    ensureCommonsenseSubstrate();
    const data = ctx.state.commonsense.assumptions.get(dtuId);
    if (!data) return { ok: true, assumptions: [], message: "No assumptions surfaced yet" };
    return { ok: true, assumptions: data.assumptions };
  }, { public: true });

  // ===== GROUNDING MACROS =====

  register("grounding", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("grounding_status");
    ensureGroundingEngine();
    return {
      ok: true, sensors: ctx.state.grounding.sensors.size, readings: ctx.state.grounding.readings.length,
      groundedDtus: ctx.state.grounding.groundedDtus.size, pendingActions: ctx.state.grounding.pendingActions.length,
      calendarEvents: ctx.state.grounding.calendar.size, stats: ctx.state.grounding.stats, invariants: GROUNDING_INVARIANTS
    };
  }, { public: true });

  register("grounding", "register_sensor", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_sensor");
    return registerSensor(input);
  }, { public: false });

  register("grounding", "record_reading", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_reading");
    const sensorId = String(input.sensorId || "");
    if (!sensorId) return { ok: false, error: "sensorId required" };
    if (input.value === undefined) return { ok: false, error: "value required" };
    return recordSensorReading(sensorId, input.value, input.timestamp);
  }, { public: false });

  register("grounding", "list_sensors", (ctx, _input = {}) => {
    enforceEthosInvariant("grounding_list_sensors");
    ensureGroundingEngine();
    const sensors = Array.from(ctx.state.grounding.sensors.values()).map(s => ({
      id: s.id, name: s.name, type: s.type, unit: s.unit, lastReading: s.lastReading?.value, status: s.status
    }));
    return { ok: true, sensors };
  }, { public: true });

  register("grounding", "ground_dtu", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_ground");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    return groundDtu(dtuId, input);
  }, { public: false });

  register("grounding", "link_calendar", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_calendar");
    const dtuId = String(input.dtuId || "");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    return linkToCalendar(dtuId, input);
  }, { public: false });

  register("grounding", "propose_action", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_propose");
    return proposeAction(input);
  }, { public: false });

  register("grounding", "approve_action", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_approve");
    if (!["owner", "admin", "founder"].includes(ctx.actor?.role)) return { ok: false, error: "Action approval requires owner/admin role" };
    const actionId = String(input.actionId || "");
    if (!actionId) return { ok: false, error: "actionId required" };
    return approveAction(actionId);
  }, { public: false });

  register("grounding", "pending_actions", (ctx, _input = {}) => {
    enforceEthosInvariant("grounding_pending");
    ensureGroundingEngine();
    const actions = ctx.state.grounding.pendingActions.map(a => ({
      id: a.id, type: a.type, description: a.description, goalId: a.goalId, proposedAt: a.proposedAt
    }));
    return { ok: true, actions };
  }, { public: true });

  register("grounding", "context", (ctx, _input = {}) => {
    enforceEthosInvariant("grounding_context");
    return { ok: true, context: getCurrentGroundedContext() };
  }, { public: true });

  register("grounding", "recent_readings", (ctx, input = {}) => {
    enforceEthosInvariant("grounding_readings");
    ensureGroundingEngine();
    const limit = clamp(Number(input.limit || 20), 1, 100);
    return { ok: true, readings: ctx.state.grounding.readings.slice(-limit) };
  }, { public: true });

  // ===== REASONING CHAINS MACROS =====

  register("reasoning", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("reasoning_status");
    ensureReasoningEngine();
    return { ok: true, chains: ctx.state.reasoning.chains.size, steps: ctx.state.reasoning.steps.size, stats: ctx.state.reasoning.stats, config: ctx.state.reasoning.config, invariants: REASONING_INVARIANTS };
  }, { public: true });

  register("reasoning", "create_chain", (ctx, input = {}) => {
    enforceEthosInvariant("reasoning_create");
    return createReasoningChain(input);
  }, { public: false });

  register("reasoning", "add_step", (ctx, input = {}) => {
    enforceEthosInvariant("reasoning_step");
    const chainId = String(input.chainId || "");
    if (!chainId) return { ok: false, error: "chainId required" };
    return addReasoningStep(chainId, input);
  }, { public: false });

  register("reasoning", "conclude", (ctx, input = {}) => {
    enforceEthosInvariant("reasoning_conclude");
    const chainId = String(input.chainId || "");
    if (!chainId) return { ok: false, error: "chainId required" };
    return concludeChain(chainId, input);
  }, { public: false });

  register("reasoning", "get_trace", (ctx, input = {}) => {
    enforceEthosInvariant("reasoning_trace");
    const chainId = String(input.chainId || "");
    if (!chainId) return { ok: false, error: "chainId required" };
    return getReasoningTrace(chainId);
  }, { public: true });

  register("reasoning", "validate_step", (ctx, input = {}) => {
    enforceEthosInvariant("reasoning_validate");
    const stepId = String(input.stepId || "");
    if (!stepId) return { ok: false, error: "stepId required" };
    return validateStep(stepId);
  }, { public: true });

  register("reasoning", "list_chains", (ctx, _input = {}) => {
    enforceEthosInvariant("reasoning_list");
    ensureReasoningEngine();
    const chains = Array.from(ctx.state.reasoning.chains.values()).slice(-50)
      .map(c => ({ id: c.id, question: c.question, status: c.status, stepCount: c.steps.length, confidence: c.confidence }));
    return { ok: true, chains };
  }, { public: true });

  // ===== INFERENCE ENGINE MACROS =====

  register("inference", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("inference_status");
    return getInferenceStatus();
  }, { public: true });

  register("inference", "add_fact", (ctx, input = {}) => {
    enforceEthosInvariant("inference_add_fact");
    return addInferenceFact(input);
  }, { public: true });

  register("inference", "add_rule", (ctx, input = {}) => {
    enforceEthosInvariant("inference_add_rule");
    return addInferenceRule(input);
  }, { public: true });

  register("inference", "query", (ctx, input = {}) => {
    enforceEthosInvariant("inference_query");
    return queryWithInference(input);
  }, { public: true });

  register("inference", "syllogism", (ctx, input = {}) => {
    enforceEthosInvariant("inference_syllogism");
    return syllogisticReason(input);
  }, { public: true });

  register("inference", "forward_chain", (ctx, input = {}) => {
    enforceEthosInvariant("inference_forward_chain");
    const derivations = forwardChain(input.maxIterations);
    return {
      ok: true,
      derivations: derivations.map(d => ({
        subject: d.subject, predicate: d.predicate, object: d.object,
        negated: d.negated, confidence: d.confidence, derivedFrom: d.derivedFrom
      }))
    };
  }, { public: true });

  // ===== HYPOTHESIS ENGINE MACROS =====

  register("hypothesis", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("hypothesis_status");
    ensureHypothesisEngine();
    return {
      ok: true, hypotheses: ctx.state.hypothesisEngine.hypotheses.size,
      experiments: ctx.state.hypothesisEngine.experiments.size,
      evidence: ctx.state.hypothesisEngine.evidence.size,
      stats: ctx.state.hypothesisEngine.stats, config: ctx.state.hypothesisEngine.config,
      invariants: HYPOTHESIS_INVARIANTS
    };
  }, { public: true });

  register("hypothesis", "propose", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_propose");
    return proposeHypothesis(input);
  }, { public: false });

  register("hypothesis", "design_experiment", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_experiment");
    const hypothesisId = String(input.hypothesisId || "");
    if (!hypothesisId) return { ok: false, error: "hypothesisId required" };
    return designExperiment(hypothesisId, input);
  }, { public: false });

  register("hypothesis", "record_evidence", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_evidence");
    const hypothesisId = String(input.hypothesisId || "");
    if (!hypothesisId) return { ok: false, error: "hypothesisId required" };
    return recordEvidence(hypothesisId, input);
  }, { public: false });

  register("hypothesis", "evaluate", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_evaluate");
    const hypothesisId = String(input.hypothesisId || "");
    if (!hypothesisId) return { ok: false, error: "hypothesisId required" };
    return evaluateHypothesis(hypothesisId);
  }, { public: false });

  register("hypothesis", "get", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_get");
    ensureHypothesisEngine();
    const hypothesisId = String(input.hypothesisId || input.id || "");
    if (!hypothesisId) return { ok: false, error: "hypothesisId required" };
    const h = ctx.state.hypothesisEngine.hypotheses.get(hypothesisId);
    if (!h) return { ok: false, error: "Hypothesis not found" };
    return { ok: true, hypothesis: h };
  }, { public: true });

  register("hypothesis", "list", (ctx, input = {}) => {
    enforceEthosInvariant("hypothesis_list");
    ensureHypothesisEngine();
    const state = input.state;
    let hypotheses = Array.from(ctx.state.hypothesisEngine.hypotheses.values());
    if (state) hypotheses = hypotheses.filter(h => h.state === state);
    hypotheses = hypotheses.slice(-50).map(h => ({
      id: h.id, statement: h.statement.slice(0, 100), state: h.state,
      posteriorConfidence: h.posteriorConfidence, evidenceCount: h.evidenceFor.length + h.evidenceAgainst.length
    }));
    return { ok: true, hypotheses };
  }, { public: true });

  // ===== METACOGNITION MACROS =====

  register("metacognition", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("metacognition_status");
    ensureMetacognitionSystem();
    return {
      ok: true, assessments: ctx.state.metacognition.assessments.length,
      predictions: ctx.state.metacognition.predictions.size,
      blindSpots: ctx.state.metacognition.blindSpots.length,
      stats: ctx.state.metacognition.stats, invariants: METACOGNITION_INVARIANTS
    };
  }, { public: true });

  register("metacognition", "assess", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_assess");
    const topic = String(input.topic || "");
    if (!topic) return { ok: false, error: "topic required" };
    return assessKnowledge(topic);
  }, { public: true });

  register("metacognition", "predict", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_predict");
    return recordPrediction(input);
  }, { public: false });

  register("metacognition", "resolve_prediction", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_resolve");
    const predictionId = String(input.predictionId || input.id || "");
    if (!predictionId) return { ok: false, error: "predictionId required" };
    const wasCorrect = input.correct === true || input.wasCorrect === true;
    return resolvePrediction(predictionId, wasCorrect);
  }, { public: false });

  register("metacognition", "calibration", (ctx, _input = {}) => {
    enforceEthosInvariant("metacognition_calibration");
    return getCalibrationReport();
  }, { public: true });

  register("metacognition", "select_strategy", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_strategy");
    const problem = String(input.problem || "");
    if (!problem) return { ok: false, error: "problem description required" };
    return selectStrategy(problem);
  }, { public: true });

  register("metacognition", "blind_spots", (ctx, _input = {}) => {
    enforceEthosInvariant("metacognition_blindspots");
    ensureMetacognitionSystem();
    return { ok: true, blindSpots: ctx.state.metacognition.blindSpots.slice(-20) };
  }, { public: true });

  register("metacognition", "introspect", (ctx, _input = {}) => {
    enforceEthosInvariant("metacognition_introspect");
    return introspectOnFailures();
  }, { public: true });

  register("metacognition", "analyze_failure", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_analyze_failure");
    const predictionId = String(input.predictionId || input.id || "");
    if (!predictionId) return { ok: false, error: "predictionId required" };
    return analyzeFailure(predictionId);
  }, { public: true });

  register("metacognition", "adapt_strategy", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_adapt");
    const domain = String(input.domain || "general");
    return adaptReasoningStrategy(domain, input.feedback || {});
  }, { public: true });

  register("metacognition", "introspection_status", (ctx, _input = {}) => {
    enforceEthosInvariant("metacognition_introspection_status");
    return getIntrospectionStatus();
  }, { public: true });

  register("metacognition", "adjust_confidence", (ctx, input = {}) => {
    enforceEthosInvariant("metacognition_adjust_confidence");
    const domain = String(input.domain || "general");
    const confidence = clamp(Number(input.confidence || 0.5), 0, 1);
    return adjustConfidenceFromLearning(domain, confidence);
  }, { public: true });

  // ===== EXPLANATION ENGINE MACROS =====

  register("explanation", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("explanation_status");
    ensureExplanationEngine();
    return { ok: true, generated: ctx.state.explanations.generated.length, stats: ctx.state.explanations.stats, invariants: EXPLANATION_INVARIANTS };
  }, { public: true });

  register("explanation", "generate", (ctx, input = {}) => {
    enforceEthosInvariant("explanation_generate");
    return generateExplanation(input);
  }, { public: true });

  register("explanation", "explain_dtu", (ctx, input = {}) => {
    enforceEthosInvariant("explanation_dtu");
    const dtuId = String(input.dtuId || "");
    const changeType = String(input.changeType || "created");
    if (!dtuId) return { ok: false, error: "dtuId required" };
    return explainDtuChange(dtuId, changeType);
  }, { public: true });

  register("explanation", "recent", (ctx, input = {}) => {
    enforceEthosInvariant("explanation_recent");
    ensureExplanationEngine();
    const limit = clamp(Number(input.limit || 20), 1, 100);
    return { ok: true, explanations: ctx.state.explanations.generated.slice(-limit) };
  }, { public: true });

  // ===== META-LEARNING MACROS =====

  register("metalearning", "status", (ctx, _input = {}) => {
    enforceEthosInvariant("metalearning_status");
    ensureMetaLearningSystem();
    return {
      ok: true, strategies: ctx.state.metaLearning.strategies.size,
      performance: ctx.state.metaLearning.performance.length,
      adaptations: ctx.state.metaLearning.adaptations.length,
      curriculums: ctx.state.metaLearning.curriculum.length,
      stats: ctx.state.metaLearning.stats, invariants: META_LEARNING_INVARIANTS
    };
  }, { public: true });

  register("metalearning", "define_strategy", (ctx, input = {}) => {
    enforceEthosInvariant("metalearning_define");
    return defineLearningStrategy(input);
  }, { public: false });

  register("metalearning", "record_outcome", (ctx, input = {}) => {
    enforceEthosInvariant("metalearning_outcome");
    const strategyId = String(input.strategyId || "");
    if (!strategyId) return { ok: false, error: "strategyId required" };
    return recordStrategyOutcome(strategyId, input);
  }, { public: false });

  register("metalearning", "adapt", (ctx, input = {}) => {
    enforceEthosInvariant("metalearning_adapt");
    const strategyId = String(input.strategyId || "");
    if (!strategyId) return { ok: false, error: "strategyId required" };
    return adaptStrategy(strategyId);
  }, { public: false });

  register("metalearning", "curriculum", (ctx, input = {}) => {
    enforceEthosInvariant("metalearning_curriculum");
    const topic = String(input.topic || "");
    if (!topic) return { ok: false, error: "topic required" };
    return generateCurriculum(topic, input);
  }, { public: true });

  register("metalearning", "best_strategy", (ctx, input = {}) => {
    enforceEthosInvariant("metalearning_best");
    const domain = String(input.domain || "general");
    return getBestStrategy(domain);
  }, { public: true });

  register("metalearning", "list_strategies", (ctx, _input = {}) => {
    enforceEthosInvariant("metalearning_list");
    ensureMetaLearningSystem();
    const strategies = Array.from(ctx.state.metaLearning.strategies.values())
      .map(s => ({ id: s.id, name: s.name, domain: s.domain, uses: s.uses, avgPerformance: s.avgPerformance }));
    return { ok: true, strategies };
  }, { public: true });

  register("metalearning", "adaptations", (ctx, _input = {}) => {
    enforceEthosInvariant("metalearning_adaptations");
    ensureMetaLearningSystem();
    return { ok: true, adaptations: ctx.state.metaLearning.adaptations.slice(-30) };
  }, { public: true });

  // ===== END META-LEARNING MACROS =====
}
