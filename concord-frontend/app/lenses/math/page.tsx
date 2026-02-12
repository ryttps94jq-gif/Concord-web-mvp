'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { Calculator, Play, CheckCircle, XCircle, Sigma, Pi, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { ErrorState } from '@/components/common/EmptyState';

interface ExpressionRecord {
  expression: string;
  result: string;
  verified: boolean;
  evaluatedAt: string;
}

interface MathStatsData {
  label: string;
  value: string;
}

const SEED_STATS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function MathLensPage() {
  useLensNav('math');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<{ value: string; verified: boolean } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Fetch stats from backend via lens data
  const {
    items: statsItems,
    isLoading: statsLoading, isError: isError, error: error, refetch: refetch,
    update: updateStat,
  } = useLensData<MathStatsData>('math', 'stats', {
    seed: SEED_STATS,
  });

  // Fetch expression history from backend
  const {
    items: expressionItems,
    isLoading: expLoading, isError: isError2, error: error2, refetch: refetch2,
    create: createExpression,
  } = useLensData<ExpressionRecord>('math', 'expression', { seed: [] });

  const stats = {
    expressions: statsItems.find(s => s.data.label === 'Expressions'),
    verified: statsItems.find(s => s.data.label === 'Verified'),
    constants: statsItems.find(s => s.data.label === 'Constants'),
    accuracy: statsItems.find(s => s.data.label === 'Accuracy'),
  };

  // Compute live stats from expression history
  const totalExpressions = expressionItems.length;
  const verifiedCount = expressionItems.filter(e => e.data.verified).length;
  const accuracyPct = totalExpressions > 0
    ? `${Math.round((verifiedCount / totalExpressions) * 100)}%`
    : '100%';

  const handleEvaluate = async () => {
    if (!expression.trim()) return;

    setEvaluating(true);
    setResult(null);
    try {
      // Send the expression to the backend for server-side evaluation
      const response = await apiHelpers.chat.ask(expression, 'math');
      const respData = response.data;

      // Extract the result from the API response
      let evalValue: string;
      let verified: boolean;

      if (respData && typeof respData === 'object') {
        // The chat.ask response typically has a `reply` or `answer` field
        evalValue = String(
          respData.result ?? respData.answer ?? respData.reply ?? respData.message ?? respData.data ?? 'No result'
        );
        verified = respData.verified !== false && evalValue !== 'Error' && evalValue !== 'No result';
      } else {
        evalValue = String(respData);
        verified = true;
      }

      setResult({ value: evalValue, verified });

      // Persist the expression + result to lens data
      await createExpression({
        title: expression,
        data: {
          expression,
          result: evalValue,
          verified,
          evaluatedAt: new Date().toISOString(),
        } as unknown as Partial<ExpressionRecord>,
        meta: { tags: ['math', verified ? 'verified' : 'unverified'], status: verified ? 'verified' : 'error' },
      });

      // Update stats in backend
      if (stats.expressions) {
        await updateStat(stats.expressions.id, {
          data: { label: 'Expressions', value: String(totalExpressions + 1) } as unknown as Partial<MathStatsData>,
        });
      }
      if (stats.verified && verified) {
        await updateStat(stats.verified.id, {
          data: { label: 'Verified', value: String(verifiedCount + 1) } as unknown as Partial<MathStatsData>,
        });
      }
    } catch {
      setResult({ value: 'Error: Failed to evaluate', verified: false });
    } finally {
      setEvaluating(false);
    }
  };

  const examples = [
    { label: 'Quadratic', expr: '(-5 + sqrt(25 - 4*2*3)) / (2*2)' },
    { label: 'Fibonacci', expr: '(1.618^10 - (-0.618)^10) / 2.236' },
    { label: 'Golden Ratio', expr: '(1 + sqrt(5)) / 2' },
  ];

  const isLoading = statsLoading || expLoading;


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">&#x1F9EE;</span>
        <div>
          <h1 className="text-xl font-bold">Math Lens</h1>
          <p className="text-sm text-gray-400">
            DTU verifier playground for mathematical proofs
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading math data...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="lens-card">
              <Calculator className="w-5 h-5 text-neon-blue mb-2" />
              <p className="text-2xl font-bold">{totalExpressions || stats.expressions?.data.value || '0'}</p>
              <p className="text-sm text-gray-400">Expressions</p>
            </div>
            <div className="lens-card">
              <Sigma className="w-5 h-5 text-neon-purple mb-2" />
              <p className="text-2xl font-bold">{verifiedCount || stats.verified?.data.value || '0'}</p>
              <p className="text-sm text-gray-400">Verified</p>
            </div>
            <div className="lens-card">
              <Pi className="w-5 h-5 text-neon-cyan mb-2" />
              <p className="text-2xl font-bold">{'\u03C0'}</p>
              <p className="text-sm text-gray-400">Constants</p>
            </div>
            <div className="lens-card">
              <CheckCircle className="w-5 h-5 text-neon-green mb-2" />
              <p className="text-2xl font-bold">{accuracyPct}</p>
              <p className="text-sm text-gray-400">Accuracy</p>
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-neon-blue" />
              Expression Evaluator
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !evaluating && handleEvaluate()}
                placeholder="Enter mathematical expression..."
                className="input-lattice flex-1 font-mono"
                disabled={evaluating}
              />
              <button
                onClick={handleEvaluate}
                disabled={evaluating || !expression.trim()}
                className="btn-neon purple flex items-center gap-1 disabled:opacity-50"
              >
                {evaluating ? (
                  <Loader2 className="w-4 h-4 mr-1 inline animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2 inline" />
                )}
                {evaluating ? 'Evaluating...' : 'Evaluate'}
              </button>
            </div>
            {result && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${
                result.verified ? 'bg-neon-green/20' : 'bg-neon-pink/20'
              }`}>
                {result.verified ? (
                  <CheckCircle className="w-5 h-5 text-neon-green" />
                ) : (
                  <XCircle className="w-5 h-5 text-neon-pink" />
                )}
                <span className="font-mono text-xl">{result.value}</span>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="font-semibold mb-4">Quick Examples</h2>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setExpression(ex.expr)}
                  className="px-3 py-2 bg-lattice-surface rounded-lg text-sm hover:bg-lattice-elevated"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expression History */}
          {expressionItems.length > 0 && (
            <div className="panel p-4">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Sigma className="w-4 h-4 text-neon-purple" />
                Recent Evaluations
              </h2>
              <div className="space-y-2">
                {expressionItems.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-lattice-deep rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.data.verified ? (
                        <CheckCircle className="w-4 h-4 text-neon-green" />
                      ) : (
                        <XCircle className="w-4 h-4 text-neon-pink" />
                      )}
                      <div>
                        <p className="text-sm font-mono">{item.data.expression || item.title}</p>
                        <p className="text-xs text-gray-500">
                          {item.data.evaluatedAt
                            ? new Date(item.data.evaluatedAt).toLocaleString()
                            : new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-neon-blue">{item.data.result}</span>
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
