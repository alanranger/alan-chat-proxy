import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Canonical 64Q questions (temporary: using 68Q list, will refine to 64Q later)
// TODO: Move to universal source (database table or shared JSON) after testing
const QUERIES = [
  "whens the next bluebell workshops and whats the cost",
  "when is the next devon workshop",
  "what is your next workshop date and where is it",
  "when are your next Autumn workshops and where are they?",
  "How long are your workshops?",
  "How much is a residential photography course and does it include B&B",
  "What is the difference between prime and zoom lenses?",
  "What memory card should I buy?",
  "Do you offer gift vouchers?",
  "What is HDR photography?",
  "What tripod do you recommend",
  "What is long exposure and how can I find out more about it",
  "How do I improve my composition and storytelling in photos?",
  "\"What is the exposure triangle (aperture, shutter, ISO)?\"",
  "How do I improve my photography skills?",
  "What is your cancellation or refund policy for courses/workshops?",
  "Do you do astrophotography workshops",
  "Can my 14yr old attend your workshop",
  "My pictures never seem sharp.  Can you advise on what I am doing wrong",
  "What types of photography services do you offer?",
  "What sort of camera do I need for your camera course",
  "What gear or equipment do I need to bring to a workshop?",
  "Do you I get a certificate with the photography course",
  "Do I need a laptop for the lightroom course",
  "Is the online photography course really free",
  "What courses do you offer for complete beginners?",
  "How many weeks is the beginners' photography course?",
  "How do I get personalised feedback on my images",
  "How can I contact you or book a discovery call?",
  "Where is your gallery and can I submit my images for feedback?",
  "\"What is depth of field, and how do I control it?\"",
  "What is white balance and how do I use it?",
  "Who is Alan Ranger and what is his photographic background?",
  "Where is Alan Ranger based?",
  "Can I hire you as a professional photographer in Coventry?",
  "peter orton",
  "who is alan ranger",
  "How do I subscribe to the free online photography course?",
  "How do I use flash photography?",
  "How do I edit RAW files?",
  "how do I focus in landscape photography",
  "how do I improve my photography",
  "how do I photograph autumn colours",
  "how do I photograph bluebells",
  "how do I photograph flowers",
  "how do I photograph people",
  "how do I photograph seascapes",
  "how do I photograph sunsets",
  "how do I photograph waterfalls",
  "how do I photograph wildlife",
  "how do I take better landscape photos",
  "how do I use a tripod",
  "what camera should I buy",
  "what is a histogram",
  "what is aperture",
  "what is composition in photography",
  "what is depth of field",
  "what is golden hour",
  "what is ISO",
  "what is long exposure photography",
  "what is macro photography",
  "what is portrait photography",
  "what is shutter speed",
  "what is the best camera for beginners",
  "what is the best lens for landscape photography",
  "what is the best time of day for landscape photography",
  "what is the rule of thirds",
  "what settings should I use for landscape photography"
];

type RunBody = {
  job_id: number;
  job_name?: string;
  test_phase: "before" | "after";
};

const siteUrl =
  Deno.env.get("PUBLIC_SITE_URL") ??
  Deno.env.get("NEXT_PUBLIC_SITE_URL") ??
  "https://alan-chat-proxy.vercel.app";

const adminToken = Deno.env.get("INGEST_TOKEN") ?? "";

async function callChatApi(question: string) {
  const url = new URL("/api/chat", siteUrl);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: question,
      sessionId: `regression-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
    })
  });

  if (!res.ok) {
    throw new Error(`chat api error ${res.status}`);
  }
  return await res.json();
}

async function createTestResult(body: RunBody, results: unknown[]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const url = new URL("/rest/v1/regression_test_results", supabaseUrl);
  url.searchParams.set("select", "id");

  const payload = {
    job_id: body.job_id,
    successful_tests: QUERIES.length,
    failed_tests: 0,
    avg_confidence: null,
    total_questions: QUERIES.length,
    test_phase: body.test_phase,
    results,
    test_timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    is_fixed_baseline: false,
    question_set_version: "canonical-64q" // New unified question set
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insert regression_test_results failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const row = Array.isArray(json) ? json[0] : json;
  return row?.id as number;
}

async function linkResultToRun(jobId: number, testId: number, phase: RunBody["test_phase"]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const url = new URL("/rest/v1/regression_test_runs", supabaseUrl);
  url.searchParams.set("job_id", `eq.${jobId}`);
  url.searchParams.set("order", "run_started_at.desc");
  url.searchParams.set("limit", "1");

  const getRes = await fetch(url.toString(), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!getRes.ok) return;
  const data = await getRes.json();
  const run = Array.isArray(data) ? data[0] : data;
  if (!run?.id) return;

  const patchUrl = new URL(`/rest/v1/regression_test_runs?id=eq.${run.id}`, supabaseUrl);
  const patchBody =
    phase === "before"
      ? { baseline_test_id: testId }
      : { after_test_id: testId };

  await fetch(patchUrl.toString(), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    },
    body: JSON.stringify(patchBody)
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!body.job_id || !body.test_phase) {
    return new Response(
      JSON.stringify({ ok: false, error: "job_id and test_phase required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const results: unknown[] = [];
    for (let i = 0; i < QUERIES.length; i += 1) {
      const question = QUERIES[i];
      const chatRes = await callChatApi(question);
      results.push({
        query: question,
        index: i + 1,
        response: chatRes,
        timestamp: new Date().toISOString()
      });
    }

    const testId = await createTestResult(body, results);
    await linkResultToRun(body.job_id, testId, body.test_phase);

    return new Response(
      JSON.stringify({
        ok: true,
        test_result_id: testId,
        total_questions: QUERIES.length
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});


