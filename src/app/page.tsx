"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Org = { id: string; name: string; region: string; team_code: string };
type Membership = { organization_id: string; role: string; organization: Org };
type Incident = { id: string; organization_id: string; code: string; title: string; hazard: string; region: string; severity: number; status: "active" | "contained" | "resolved"; lead: string; brief: string; created_at: string };
type Need = { id: string; organization_id: string; incident_id: string; category: string; quantity: number; unit: string; priority: string; status: string; details: string; created_at: string };
type Resource = { id: string; organization_id: string; category: string; label: string; quantity_available: number; unit: string; region: string; updated_at: string };
type Allocation = { request_id: string; quantity: number };

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? createClient() : null;
const categories = ["Drinking water", "Food", "Medical supplies", "Shelter", "Transport", "Power", "Communications", "Rescue equipment", "Other"];
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [orgId, updateOrgId] = useState("");
  const selectedOrgRef = useRef("");
  const setOrgId = (id: string) => { selectedOrgRef.current = id; updateOrgId(id); };
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [incidentId, setIncidentId] = useState("");
  const [panel, setPanel] = useState<"overview" | "incidents" | "needs" | "resources">("overview");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgRegion, setOrgRegion] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [title, setTitle] = useState("");
  const [hazard, setHazard] = useState("Flooding");
  const [region, setRegion] = useState("");
  const [severity, setSeverity] = useState("2");
  const [lead, setLead] = useState("");
  const [brief, setBrief] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kits");
  const [priority, setPriority] = useState("high");
  const [details, setDetails] = useState("");
  const [resourceLabel, setResourceLabel] = useState("");
  const [resourceQty, setResourceQty] = useState("");
  const [resourceUnit, setResourceUnit] = useState("kits");
  const [resourceRegion, setResourceRegion] = useState("");
  const [showOrg, setShowOrg] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [showNeed, setShowNeed] = useState(false);
  const [showResource, setShowResource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeMembership = memberships.find((item) => item.organization_id === orgId);
  const org = activeMembership?.organization;
  const activeIncidents = incidents.filter((item) => item.status !== "resolved");
  const openNeeds = needs.filter((item) => item.status !== "fulfilled");
  const urgentNeeds = openNeeds.filter((item) => item.priority === "critical" || item.priority === "high");

  async function refresh(userId: string, preferredOrgId?: string | boolean) {
    if (!supabase) return;
    const { data: memberRows, error: memberError } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId);
    if (memberError) throw memberError;
    const ids = (memberRows ?? []).map((row) => row.organization_id as string);
    const orgResult = ids.length ? await supabase.from("organizations").select("id,name,region,team_code").in("id", ids) : { data: [], error: null };
    if (orgResult.error) throw orgResult.error;
    const orgMap = new Map((orgResult.data ?? []).map((row) => [row.id, row as Org]));
    const next = (memberRows ?? []).flatMap((row) => { const found = orgMap.get(row.organization_id as string); return found ? [{ organization_id: row.organization_id as string, role: row.role as string, organization: found }] : []; });
    setMemberships(next);
    const desiredOrgId = typeof preferredOrgId === "string" ? preferredOrgId : selectedOrgRef.current;
    const nextId = desiredOrgId && next.some((row) => row.organization_id === desiredOrgId) ? desiredOrgId : next.some((row) => row.organization_id === orgId) ? orgId : next[0]?.organization_id ?? "";
    setOrgId(nextId);
    if (!nextId) { setIncidents([]); setNeeds([]); setResources([]); setAllocations([]); return; }
    const [incidentResult, needResult, resourceResult, allocationResult] = await Promise.all([
      supabase.from("incidents").select("*").eq("organization_id", nextId).order("created_at", { ascending: false }),
      supabase.from("resource_requests").select("*").eq("organization_id", nextId).order("created_at", { ascending: false }),
      supabase.from("resource_inventory").select("*").eq("organization_id", nextId).order("category"),
      supabase.from("allocations").select("request_id,quantity").eq("organization_id", nextId),
    ]);
    for (const result of [incidentResult, needResult, resourceResult, allocationResult]) if (result.error) throw result.error;
    setIncidents((incidentResult.data ?? []) as Incident[]);
    setNeeds((needResult.data ?? []) as Need[]);
    setResources((resourceResult.data ?? []) as Resource[]);
    setAllocations((allocationResult.data ?? []) as Allocation[]);
    setIncidentId((current) => (incidentResult.data ?? []).some((row) => row.id === current) ? current : (incidentResult.data?.[0]?.id as string | undefined) ?? "");
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      if (data.session?.user) refresh(data.session.user.id).catch((cause: Error) => setError(cause.message));
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setError("");
      if (next?.user) refresh(next.user.id).catch((cause: Error) => setError(cause.message));
      else { setMemberships([]); setIncidents([]); setNeeds([]); setResources([]); }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return; setBusy(true); setError(""); setNotice("");
    try {
      if (authMode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
      } else { const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (authError) throw authError; }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not authenticate."); } finally { setBusy(false); }
  }
  async function orgAction(event: FormEvent<HTMLFormElement>, mode: "create" | "join") {
    event.preventDefault(); if (!supabase || !session?.user) return; setBusy(true); setError("");
    try {
      const { data, error: rpcError } = mode === "create"
        ? await supabase.rpc("create_organization", { p_name: orgName.trim(), p_region: orgRegion.trim() })
        : await supabase.rpc("join_organization", { p_team_code: teamCode.trim().toUpperCase() });
      if (rpcError) throw rpcError;
      await refresh(session.user.id, data as string); setOrgId(data as string); setShowOrg(false); setNotice(mode === "create" ? "Response workspace created. Share its code only with trusted responders." : "You joined the response workspace.");
      setOrgName(""); setOrgRegion(""); setTeamCode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the organization."); } finally { setBusy(false); }
  }
  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user || !org) return; setBusy(true); setError("");
    try {
      const { error: insertError } = await supabase.from("incidents").insert({ organization_id: org.id, title: title.trim(), hazard, region: region.trim(), severity: Number(severity), lead: lead.trim(), brief: brief.trim(), created_by: session.user.id });
      if (insertError) throw insertError; await refresh(session.user.id); setTitle(""); setRegion(""); setLead(""); setBrief(""); setShowIncident(false); setNotice("Incident added to the shared coordination board.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the incident."); } finally { setBusy(false); }
  }
  async function createNeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user || !org || !incidentId) return; setBusy(true); setError("");
    try {
      const { error: insertError } = await supabase.from("resource_requests").insert({ organization_id: org.id, incident_id: incidentId, category, quantity: Number(quantity), unit: unit.trim(), priority, details: details.trim(), created_by: session.user.id });
      if (insertError) throw insertError; await refresh(session.user.id); setQuantity(""); setDetails(""); setShowNeed(false); setNotice("Resource need posted to the coordination queue.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the resource need."); } finally { setBusy(false); }
  }
  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !session?.user || !org) return; setBusy(true); setError("");
    try {
      const { error: insertError } = await supabase.from("resource_inventory").insert({ organization_id: org.id, category, label: resourceLabel.trim(), quantity_available: Number(resourceQty), unit: resourceUnit.trim(), region: resourceRegion.trim(), updated_by: session.user.id });
      if (insertError) throw insertError; await refresh(session.user.id); setResourceLabel(""); setResourceQty(""); setResourceRegion(""); setShowResource(false); setNotice("Resource added to available inventory.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the resource."); } finally { setBusy(false); }
  }
  async function allocate(need: Need) {
    if (!supabase || !session?.user) return; setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("allocate_request", { p_request_id: need.id });
      if (rpcError) throw rpcError; await refresh(session.user.id); setNotice(Number(data) > 0 ? `${data} ${need.unit} allocated from available inventory.` : "No matching inventory is currently available.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not allocate inventory."); } finally { setBusy(false); }
  }
  async function updateIncident(incident: Incident, status: Incident["status"]) {
    if (!supabase || !session?.user) return; setBusy(true); setError("");
    try { const { error: updateError } = await supabase.from("incidents").update({ status }).eq("id", incident.id); if (updateError) throw updateError; await refresh(session.user.id); setNotice(`Incident marked ${status}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update incident."); } finally { setBusy(false); }
  }
  async function copyCode() { if (!org) return; try { await navigator.clipboard.writeText(org.team_code); setNotice("Workspace code copied. Share only with trusted responders."); } catch { setNotice(`Workspace code: ${org.team_code}`); } }

  if (!ready) return <main className="loading"><span className="beacon" />Opening ReliefGrid…</main>;
  if (!session) return <main className="auth-layout"><section className="auth-art"><a className="wordmark" href="#access"><span className="mark">R</span><span>ReliefGrid<small>Coordinate the response.</small></span></a><div className="auth-message"><p className="kicker">FIELD COORDINATION / SHARED PICTURE</p><h1>Turn scattered<br /><em>needs into action.</em></h1><p>Align incidents, supply requests, local inventory and allocations in one private workspace for response teams.</p><div className="auth-stats"><span>01 <b>See the situation</b></span><span>02 <b>Surface urgent needs</b></span><span>03 <b>Coordinate what is available</b></span></div></div><small className="disclaimer">Operational coordination aid. Not a dispatch authority or substitute for local emergency command.</small></section><section className="auth-side" id="access"><div className="auth-brand-mobile"><a className="wordmark" href="#access"><span className="mark">R</span><span>ReliefGrid<small>Coordinate the response.</small></span></a></div><form className="auth-card" onSubmit={authenticate}><p className="kicker">PRIVATE RESPONSE WORKSPACE</p><h2>{authMode === "signin" ? "Welcome back." : "Bring your team in."}</h2><p className="muted">{authMode === "signin" ? "Sign in to view your coordination board." : "Create your responder account. You can create or join a team after signing in."}</p><div className="tabs"><button type="button" className={authMode === "signin" ? "selected" : ""} onClick={() => setAuthMode("signin")}>Sign in</button><button type="button" className={authMode === "signup" ? "selected" : ""} onClick={() => setAuthMode("signup")}>Create account</button></div><label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@organization.org" /></label><label>Password<input type="password" minLength={8} required autoComplete={authMode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>{notice && <p className="feedback success">{notice}</p>}{(error || !supabase) && <p className="feedback error" role="alert">{error || "Supabase is not configured for this deployment yet."}</p>}<button className="button main-button" disabled={busy || !supabase}>{busy ? "Working…" : authMode === "signin" ? "Open workspace" : "Create account"}</button><p className="privacy">Record operational information only. Avoid names, medical details, exact home addresses, and other sensitive personal data.</p></form></section></main>;

  const nav = [{ id: "overview", name: "Situation room", icon: "⌘" }, { id: "incidents", name: "Incidents", icon: "◈" }, { id: "needs", name: "Resource needs", icon: "↗" }, { id: "resources", name: "Available resources", icon: "▤" }] as const;
  const allocationsFor = (needId: string) => allocations.filter((row) => row.request_id === needId).reduce((sum, row) => sum + row.quantity, 0);
  const visibleNeeds = panel === "overview" ? openNeeds.slice(0, 5) : panel === "needs" ? needs : [];
  return <main className="app"><header className="topbar"><a className="wordmark" href="#main"><span className="mark">R</span><span>ReliefGrid<small>Response operations</small></span></a><div className="top-label"><i /> INCIDENT / NEEDS / SUPPLY</div><div className="account"><span>{session.user.email}</span><button className="button quiet" onClick={() => supabase?.auth.signOut()}>Sign out</button></div></header><div className="shell"><aside className="sidebar"><p className="sidebar-title">RESPONSE TEAM</p>{org ? <select value={orgId} onChange={(event) => { setOrgId(event.target.value); refresh(session.user.id, false).catch((cause: Error) => setError(cause.message)); }} aria-label="Response workspace">{memberships.map((item) => <option key={item.organization_id} value={item.organization_id}>{item.organization.name}</option>)}</select> : <p className="empty-org">Create or join a private workspace to begin coordinating.</p>}<button className="side-link" onClick={() => setShowOrg(true)}>＋ Create workspace</button><button className="side-link" onClick={() => setShowOrg(false)}>↗ Join with code</button><div className="divider" />{nav.map((item) => <button key={item.id} className={`nav-link ${panel === item.id ? "active" : ""}`} onClick={() => setPanel(item.id)}><span>{item.icon}</span>{item.name}{item.id === "needs" && openNeeds.length > 0 && <b>{openNeeds.length}</b>}</button>)}<div className="sidebar-foot"><span className="foot-mark">!</span><p><b>People-first data</b><br />No person-level lists or medical records.</p></div></aside><section className="content" id="main"><div className="heading"><div><p className="kicker">RELIEFGRID / {panel.toUpperCase()}</p><h1>{panel === "overview" ? "Situation room." : panel === "incidents" ? "Incident board." : panel === "needs" ? "Needs, prioritized." : "Available resources."}</h1><p>Shared operational picture for your response team.</p></div><div className="heading-actions"><button className="button quiet" onClick={() => refresh(session.user.id).catch((cause: Error) => setError(cause.message))}>↻ Refresh</button>{org && <button className="button primary" onClick={() => panel === "incidents" ? setShowIncident(true) : panel === "resources" ? setShowResource(true) : setShowNeed(true)}>{panel === "incidents" ? "+ New incident" : panel === "resources" ? "+ Add resource" : "+ Request resource"}</button>}</div></div>
    {(error || notice) && <div className={`alert ${error ? "alert-error" : "alert-good"}`} role={error ? "alert" : "status"}><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    {(showOrg || (!org && !showIncident && !showNeed && !showResource)) && <section className="card form-card"><div className="card-head"><div><p className="kicker">TEAM ACCESS</p><h2>{showOrg ? "Create or join a response workspace" : "Start coordinating."}</h2></div><button className="close" onClick={() => setShowOrg(false)}>×</button></div><div className="split-forms"><form onSubmit={(event) => orgAction(event, "create")}><h3>Create workspace</h3><label>Team / organization<input required minLength={2} maxLength={100} value={orgName} onChange={(event) => setOrgName(event.target.value)} placeholder="Coastal response team" /></label><label>Operating area<input maxLength={120} value={orgRegion} onChange={(event) => setOrgRegion(event.target.value)} placeholder="Region, district or zone" /></label><button className="button primary" disabled={busy}>Create private workspace</button></form><form onSubmit={(event) => orgAction(event, "join")}><h3>Join a team</h3><label>Workspace code<input required maxLength={16} value={teamCode} onChange={(event) => setTeamCode(event.target.value.toUpperCase())} placeholder="Code shared by a team member" /></label><p className="small-muted">Only enter a code shared with you by a trusted team member.</p><button className="button outline" disabled={busy}>Join workspace</button></form></div></section>}
    {showIncident && <section className="card form-card"><div className="card-head"><div><p className="kicker">SITUATION / NEW INCIDENT</p><h2>Record an operational incident.</h2></div><button className="close" onClick={() => setShowIncident(false)}>×</button></div><form className="form-grid" onSubmit={createIncident}><label>Incident title<input required minLength={3} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="River overflow across low-lying wards" /></label><label>Hazard<select value={hazard} onChange={(event) => setHazard(event.target.value)}>{["Flooding", "Severe weather", "Fire", "Infrastructure outage", "Public health", "Displacement", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Area / region<input required maxLength={140} value={region} onChange={(event) => setRegion(event.target.value)} placeholder="District or response zone; no home addresses" /></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="1">1 · Monitor</option><option value="2">2 · Elevated</option><option value="3">3 · Serious</option><option value="4">4 · Critical</option><option value="5">5 · Severe</option></select></label><label>Coordination lead<input maxLength={100} value={lead} onChange={(event) => setLead(event.target.value)} placeholder="Team role or call sign, not personal details" /></label><label className="wide">Situation brief<textarea maxLength={800} rows={3} value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Verified operational context and immediate constraints" /></label><div className="wide form-end"><span>Do not enter victim names, medical details, exact addresses or sensitive tactical information.</span><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Add incident"}</button></div></form></section>}
    {showNeed && <section className="card form-card"><div className="card-head"><div><p className="kicker">SUPPLY / REQUEST</p><h2>Make a resource need visible.</h2></div><button className="close" onClick={() => setShowNeed(false)}>×</button></div><form className="form-grid" onSubmit={createNeed}><label>Incident<select required value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>{activeIncidents.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label><label>Resource category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Quantity needed<input type="number" required min="1" max="1000000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label>Unit<input required maxLength={24} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="kits, litres, vehicles" /></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="routine">Routine</option><option value="high">High</option><option value="critical">Critical</option></select></label><label className="wide">Operational note<textarea maxLength={500} rows={2} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Delivery constraints, team contact channel or time window" /></label><div className="wide form-end"><span>Needs should describe supplies or capacity, not identifiable people.</span><button className="button primary" disabled={busy || activeIncidents.length === 0}>{busy ? "Posting…" : "Post need"}</button></div></form></section>}
    {showResource && <section className="card form-card"><div className="card-head"><div><p className="kicker">SUPPLY / INVENTORY</p><h2>Register available capacity.</h2></div><button className="close" onClick={() => setShowResource(false)}>×</button></div><form className="form-grid" onSubmit={createResource}><label>Resource name<input required maxLength={120} value={resourceLabel} onChange={(event) => setResourceLabel(event.target.value)} placeholder="Water purification unit" /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Quantity available<input type="number" required min="0" max="1000000" step="1" value={resourceQty} onChange={(event) => setResourceQty(event.target.value)} /></label><label>Unit<input required maxLength={24} value={resourceUnit} onChange={(event) => setResourceUnit(event.target.value)} /></label><label className="wide">Staging area<input maxLength={140} value={resourceRegion} onChange={(event) => setResourceRegion(event.target.value)} placeholder="Warehouse, town or response zone" /></label><div className="wide form-end"><span>Only register capacity your team can confirm and coordinate.</span><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Add to inventory"}</button></div></form></section>}
    {org && <><div className="team-bar"><span><b>{org.name}</b><i /> {org.region || "Operating area not set"}</span><button className="button outline compact" onClick={copyCode}>Team code <b>{org.team_code}</b> · Copy</button></div>
    {(panel === "overview" || panel === "incidents") && <><div className="metrics"><article><small>ACTIVE INCIDENTS</small><strong>{activeIncidents.length.toString().padStart(2, "0")}</strong><span>Not yet resolved</span><i className="metric-dot red" /></article><article><small>OPEN RESOURCE NEEDS</small><strong>{openNeeds.length.toString().padStart(2, "0")}</strong><span>{urgentNeeds.length} high / critical</span><i className="metric-dot amber" /></article><article><small>AVAILABLE RESOURCE TYPES</small><strong>{new Set(resources.filter((item) => item.quantity_available > 0).map((item) => item.category)).size.toString().padStart(2, "0")}</strong><span>Categories with inventory</span><i className="metric-dot green" /></article><article><small>ALLOCATIONS LOGGED</small><strong>{allocations.length.toString().padStart(2, "0")}</strong><span>Supply movements recorded</span><i className="metric-dot blue" /></article></div>
    <div className="section-head"><div><p className="kicker">INCIDENT PICTURE / ACTIVE OPERATIONS</p><h2>{panel === "overview" ? "Where teams are coordinating." : "Incident register."}</h2></div><button className="button outline compact" onClick={() => setShowIncident(true)}>＋ Add incident</button></div>
    <div className="incident-grid">{activeIncidents.length === 0 ? <div className="empty-card"><span>◈</span><b>No active incidents recorded.</b><p>Add a verified operational incident to begin coordinating needs.</p><button className="button outline compact" onClick={() => setShowIncident(true)}>Create first incident</button></div> : activeIncidents.map((item) => <article className={`incident-card ${incidentId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setIncidentId(item.id)}><div className="incident-top"><span className="incident-code">{item.code}</span><span className={`severity severity-${item.severity}`}>SEV {item.severity}</span></div><h3>{item.title}</h3><p className="incident-location">⌖ {item.region} <i /> {item.hazard}</p>{item.brief && <p className="incident-brief">{item.brief}</p>}<div className="incident-bottom"><span><small>LEAD</small><b>{item.lead || "Unassigned"}</b></span><span><small>OPENED</small><b>{dateLabel(item.created_at)}</b></span><button className="status-button" disabled={busy} onClick={(event) => { event.stopPropagation(); updateIncident(item, item.status === "active" ? "contained" : "resolved"); }}>{item.status === "active" ? "Mark contained →" : "Resolve →"}</button></div></article>)}</div></>}
    {(panel === "overview" || panel === "needs") && <section className="card needs-card"><div className="card-head"><div><p className="kicker">LOGISTICS / RESOURCE REQUESTS</p><h2>{panel === "overview" ? "Needs requiring coordination." : "Resource needs queue."}</h2></div><button className="button outline compact" disabled={!activeIncidents.length} onClick={() => { setIncidentId(activeIncidents[0]?.id ?? ""); setShowNeed(true); }}>＋ Post a need</button></div>{visibleNeeds.length === 0 ? <div className="empty-row">No resource requests. Post a need against an active incident.</div> : visibleNeeds.map((need) => { const already = allocationsFor(need.id); const remaining = Math.max(0, need.quantity - already); const coverage = need.quantity ? Math.min(100, Math.round(already / need.quantity * 100)) : 0; const linked = incidents.find((item) => item.id === need.incident_id); return <article className="need-row" key={need.id}><div className={`priority-mark ${need.priority}`} /><div className="need-main"><strong>{need.category}</strong><small>{linked?.code ?? "Incident"} · {linked?.region ?? ""} · {need.details || "No additional coordination notes"}</small><div className="coverage"><i style={{ width: `${coverage}%` }} /></div><small>{already} of {need.quantity} {need.unit} covered</small></div><div className="need-qty"><strong>{remaining}</strong><small>{need.unit} needed</small></div><span className={`need-status ${remaining === 0 ? "done" : need.priority}`}>{remaining === 0 ? "Covered" : need.priority}</span><button className="button primary compact" disabled={busy || remaining === 0} onClick={() => allocate(need)}>{busy ? "…" : remaining === 0 ? "Fulfilled" : "Allocate available"}</button></article>; })}</section>}
    {(panel === "overview" || panel === "resources") && <section className="card resource-card"><div className="card-head"><div><p className="kicker">SUPPLY / CONFIRMED CAPACITY</p><h2>Inventory available to coordinate.</h2></div><button className="button outline compact" onClick={() => setShowResource(true)}>＋ Register resource</button></div>{resources.length === 0 ? <div className="empty-row">No local capacity registered. Add supplies that your team can confirm.</div> : <div className="resource-grid">{resources.map((item) => <article className="resource-tile" key={item.id}><span className="resource-icon">{item.category === "Drinking water" ? "◉" : item.category === "Medical supplies" ? "+" : item.category === "Transport" ? "↗" : "▤"}</span><div><small>{item.category.toUpperCase()}</small><strong>{item.label}</strong><span>{item.region || "Location not specified"}</span></div><b className={item.quantity_available > 0 ? "stock-ready" : "stock-empty"}>{item.quantity_available}<small> {item.unit}</small></b></article>)}</div>}</section>}
    </>}
    <footer className="footer"><span>RELIEFGRID / FIELD COORDINATION</span><span>Supports coordination. Does not replace emergency command, clinical triage or verified local protocols.</span><a href="https://github.com/msetrades/mse-disaster-response" target="_blank" rel="noreferrer">Product & data notes ↗</a></footer></section></div></main>;
}
