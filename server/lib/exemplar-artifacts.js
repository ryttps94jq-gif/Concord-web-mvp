/**
 * Exemplar Artifacts — hand-crafted examples that demonstrate perfect output.
 *
 * Used in production prompts to show entities what good output looks like.
 * Loaded at startup, referenced by buildProductionPrompt().
 */

const EXEMPLARS = new Map();

export function registerExemplar(domain, action, exemplar) {
  EXEMPLARS.set(`${domain}.${action}`, exemplar);
}

export function getExemplarArtifact(domain, action) {
  return EXEMPLARS.get(`${domain}.${action}`) || null;
}

export function getExemplarCount() {
  return EXEMPLARS.size;
}

// ── Food: Meal Plan ─────────────────────────────────────────────────────────

registerExemplar("food", "generate-meal-plan", {
  title: "5-Day Mediterranean Diet Plan - 2000 Calories",
  targetCalories: 2000,
  mealsPerDay: 3,
  dietaryRestrictions: [],
  days: [
    {
      dayNumber: 1,
      meals: [
        {
          name: "Greek yogurt parfait with honey and walnuts",
          ingredients: [
            { item: "Greek yogurt", amount: "1 cup" },
            { item: "Honey", amount: "1 tablespoon" },
            { item: "Walnuts", amount: "2 tablespoons, chopped" },
            { item: "Mixed berries", amount: "1/2 cup" },
            { item: "Granola", amount: "1/4 cup" },
          ],
          calories: 420,
          protein: 22,
          prepTime: "5 minutes",
        },
        {
          name: "Grilled chicken salad with lemon vinaigrette",
          ingredients: [
            { item: "Chicken breast", amount: "6 oz, grilled" },
            { item: "Mixed greens", amount: "3 cups" },
            { item: "Cherry tomatoes", amount: "1/2 cup, halved" },
            { item: "Cucumber", amount: "1/2, sliced" },
            { item: "Feta cheese", amount: "2 tablespoons, crumbled" },
            { item: "Olive oil", amount: "1 tablespoon" },
            { item: "Lemon juice", amount: "1 tablespoon" },
          ],
          calories: 520,
          protein: 45,
          prepTime: "20 minutes",
        },
        {
          name: "Baked salmon with roasted vegetables and quinoa",
          ingredients: [
            { item: "Salmon fillet", amount: "6 oz" },
            { item: "Quinoa", amount: "3/4 cup, cooked" },
            { item: "Broccoli", amount: "1 cup" },
            { item: "Bell pepper", amount: "1, sliced" },
            { item: "Olive oil", amount: "1 tablespoon" },
            { item: "Garlic", amount: "2 cloves, minced" },
            { item: "Lemon", amount: "1/2, sliced" },
          ],
          calories: 620,
          protein: 48,
          prepTime: "35 minutes",
        },
      ],
      totalCalories: 1560,
    },
  ],
});

// ── Accounting: Invoice ─────────────────────────────────────────────────────

registerExemplar("accounting", "generate-invoice", {
  invoiceNumber: "INV-2026-0142",
  issueDate: "2026-02-15",
  dueDate: "2026-03-17",
  billTo: {
    name: "Westfield Design Co.",
    address: "1240 Oak Avenue, Suite 300, Portland, OR 97201",
    email: "accounts@westfielddesign.com",
  },
  billFrom: {
    name: "Summit Creative Studio",
    address: "890 Pine Street, Denver, CO 80202",
  },
  lineItems: [
    { description: "Brand identity design — logo, color palette, typography", quantity: 1, unitPrice: 2500.00, amount: 2500.00 },
    { description: "Website mockup — 5 pages, responsive design", quantity: 5, unitPrice: 400.00, amount: 2000.00 },
    { description: "Social media template set — Instagram, LinkedIn, Twitter", quantity: 1, unitPrice: 750.00, amount: 750.00 },
  ],
  subtotal: 5250.00,
  taxRate: 0.08,
  taxAmount: 420.00,
  total: 5670.00,
  notes: "Payment via ACH or check. Late payments subject to 1.5% monthly fee.",
  paymentTerms: "Net 30",
});

// ── Fitness: Workout Program ────────────────────────────────────────────────

registerExemplar("fitness", "generate-program", {
  title: "12-Week Beginner Strength Foundation",
  goal: "strength",
  durationWeeks: 12,
  daysPerWeek: 3,
  experienceLevel: "beginner",
  weeks: [
    {
      weekNumber: 1,
      focus: "Movement patterns and form",
      days: [
        {
          dayNumber: 1,
          name: "Full Body A",
          warmup: "5 min light cardio, 10 bodyweight squats, 10 arm circles each direction",
          exercises: [
            { name: "Goblet squat", sets: 3, reps: "10", rest: "90 seconds", notes: "Focus on depth and knee tracking" },
            { name: "Dumbbell bench press", sets: 3, reps: "10", rest: "90 seconds", notes: "Control the descent" },
            { name: "Dumbbell row", sets: 3, reps: "10 each arm", rest: "60 seconds", notes: "Squeeze at the top" },
            { name: "Dumbbell Romanian deadlift", sets: 3, reps: "10", rest: "90 seconds", notes: "Hinge at hips, slight knee bend" },
            { name: "Plank", sets: 3, reps: "30 seconds", rest: "60 seconds", notes: "Keep hips level" },
          ],
          cooldown: "5 min walking, hamstring and quad stretches, 30 sec each",
          estimatedDuration: "45 minutes",
        },
      ],
    },
  ],
});

// ── Healthcare: Care Plan ───────────────────────────────────────────────────

registerExemplar("healthcare", "build-care-plan", {
  title: "Type 2 Diabetes Management Care Plan",
  patientContext: {
    conditions: ["type 2 diabetes", "hypertension"],
    currentMedications: ["Metformin 500mg twice daily", "Lisinopril 10mg daily"],
    allergies: ["Sulfa drugs"],
  },
  goals: [
    {
      goal: "Achieve glycemic control",
      targetDate: "2026-08-01",
      measurable: "HbA1c below 7.0%",
      priority: "high",
    },
    {
      goal: "Blood pressure management",
      targetDate: "2026-06-01",
      measurable: "Consistently below 130/80 mmHg",
      priority: "high",
    },
    {
      goal: "Weight management",
      targetDate: "2026-12-01",
      measurable: "5% body weight reduction",
      priority: "medium",
    },
  ],
  interventions: [
    {
      intervention: "Blood glucose monitoring",
      frequency: "Twice daily (fasting and post-meal)",
      responsibleParty: "Patient",
      notes: "Log readings in glucose journal",
    },
    {
      intervention: "Dietary counseling — Mediterranean diet focus",
      frequency: "Monthly sessions",
      responsibleParty: "Registered Dietitian",
      notes: "Emphasize low glycemic index foods, portion control",
    },
    {
      intervention: "Exercise program — 150 min/week moderate activity",
      frequency: "5 days per week, 30 minutes",
      responsibleParty: "Patient with physical therapist guidance",
      notes: "Walking, swimming, or cycling. Avoid high-impact initially.",
    },
  ],
  followUp: {
    nextAppointment: "2026-04-15",
    monitoringSchedule: "HbA1c every 3 months, comprehensive metabolic panel every 6 months",
  },
  disclaimer: "This care plan is generated for informational purposes only and does not constitute medical advice. Always consult with a qualified healthcare provider before making medical decisions.",
});

// ── Studio: MIDI Pattern ────────────────────────────────────────────────────

registerExemplar("studio", "generate-pattern", {
  title: "Lo-Fi Hip Hop Drum Pattern — 85 BPM",
  bpm: 85,
  genre: "lo-fi hip hop",
  timeSignature: "4/4",
  bars: 4,
  notes: [
    { pitch: 36, time: 0, duration: 0.25, velocity: 0.9 },
    { pitch: 42, time: 0, duration: 0.125, velocity: 0.6 },
    { pitch: 42, time: 0.5, duration: 0.125, velocity: 0.5 },
    { pitch: 38, time: 1.0, duration: 0.25, velocity: 0.85 },
    { pitch: 42, time: 1.0, duration: 0.125, velocity: 0.6 },
    { pitch: 42, time: 1.5, duration: 0.125, velocity: 0.4 },
    { pitch: 36, time: 1.75, duration: 0.25, velocity: 0.7 },
    { pitch: 36, time: 2.0, duration: 0.25, velocity: 0.9 },
    { pitch: 42, time: 2.0, duration: 0.125, velocity: 0.6 },
    { pitch: 42, time: 2.5, duration: 0.125, velocity: 0.5 },
    { pitch: 38, time: 3.0, duration: 0.25, velocity: 0.85 },
    { pitch: 42, time: 3.0, duration: 0.125, velocity: 0.6 },
    { pitch: 42, time: 3.5, duration: 0.125, velocity: 0.45 },
    { pitch: 42, time: 3.75, duration: 0.125, velocity: 0.35 },
  ],
});

// ── Law: Contract Analysis ──────────────────────────────────────────────────

registerExemplar("law", "analyze-contract", {
  title: "SaaS Service Agreement Analysis — CloudTech Inc. / Meridian Corp",
  parties: [
    { name: "CloudTech Inc.", role: "Service Provider" },
    { name: "Meridian Corporation", role: "Client" },
  ],
  effectiveDate: "2026-03-01",
  terminationDate: "2027-02-28",
  keyTerms: [
    { clause: "Service Level Agreement", summary: "99.9% uptime guarantee with credits for downtime exceeding threshold", concern: "Credit calculation methodology is vague" },
    { clause: "Data Processing", summary: "Provider processes client data solely for service delivery", concern: "Sub-processor approval process lacks specificity" },
    { clause: "Termination", summary: "Either party may terminate with 90 days written notice", concern: "No provision for data export timeline post-termination" },
  ],
  riskAreas: [
    { risk: "Limitation of liability caps at 12 months of fees — may be insufficient for data breach damages", severity: "high", recommendation: "Negotiate higher cap for data-related incidents" },
    { risk: "Intellectual property assignment clause is overly broad", severity: "medium", recommendation: "Limit IP assignment to customizations, exclude pre-existing IP" },
  ],
  recommendations: [
    "Add specific data export timeline (30 days) after termination",
    "Define sub-processor notification and approval process",
    "Include carve-out for IP indemnification from liability cap",
  ],
  disclaimer: "This analysis is generated for informational purposes only and does not constitute legal advice. Consult a licensed attorney for legal guidance.",
});
