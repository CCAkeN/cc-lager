import React, { useEffect, useMemo, useRef, useState } from "react";

let _supabase = null;
async function getSupabase(url, key) {
  if (!url || !key) return null;
  if (_supabase) return _supabase;
  const { createClient } = await import("@supabase/supabase-js");
  _supabase = createClient(url, key);
  return _supabase;
}

const isCC = (s) => /^CC\d{4}$/.test((s || "").trim());

const QRScanner = ({ onScan, onClose }) => {
  const holder = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let scanner; let stopped = false; let Html5Qrcode;
    (async () => {
      try {
        ({ Html5Qrcode } = await import("html5-qrcode"));
        const id = "qr-reader";
        const el = document.createElement("div");
        el.id = id; holder.current?.appendChild(el);
        scanner = new Html5Qrcode(id);
        const devices = await Html5Qrcode.getCameras();
        const camId = devices?.[0]?.id; if (!camId) throw new Error("Ingen kamera hittades");
        await scanner.start(camId, { fps: 10, qrbox: { width: 260, height: 260 } }, (txt) => {
          if (stopped) return; stopped = true;
          scanner.stop().finally(() => onScan(txt.trim()));
        });
      } catch (e) { setError(e?.message || "Kunde inte starta kameran"); }
    })();
    return () => {
      try { holder.current?.querySelector("#qr-reader")?.remove(); } catch {}
    };
  }, [onScan]);

  return (
    <div className="card">
      <div ref={holder} />
      {error && <p style={{color:"#b91c1c", marginTop:8}}>{error}</p>}
      <button className="btn" onClick={onClose} style={{marginTop:12}}>Avbryt</button>
    </div>
  );
};

const QRGen = ({ value, size = 200, label }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    (async () => {
      const mod = await import("qrcode");
      const QRCode = mod.default || mod;
      const canvas = canvasRef.current;
      if (!canvas) return;
      await QRCode.toCanvas(canvas, value, { width: size, margin: 1 });
    })();
  }, [value, size]);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <canvas ref={canvasRef} />
      <div style={{marginTop:8, fontSize:14}}>{label ?? value}</div>
    </div>
  );
};

export default function App() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

  const [supabaseUrl, setSupabaseUrl] = useState(envUrl);
  const [supabaseKey, setSupabaseKey] = useState(envKey);
  const [sb, setSb] = useState(null);

  useEffect(() => {
    (async () => {
      if (!supabaseUrl || !supabaseKey) return;
      const c = await getSupabase(supabaseUrl, supabaseKey);
      setSb(c);
    })();
  }, [supabaseUrl, supabaseKey]);

  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false)

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub?.subscription?.unsubscribe();
  }, [sb]);

  const signIn = async () => {
    const { error } = await sb.auth.signInWithOtp({ email });
    if (error) alert(error.message); else alert("Kolla din e-post för inloggningslänk");
  };
  const signOut = async () => { await sb.auth.signOut(); };

  const verifyOtp = async () => {
    if (!email || !otpCode) { alert("Fyll i e-post och kod"); return; }
    const { error } = await sb.auth.verifyOtp({ email, token: otpCode, type: "email" });
    if (error) alert(error.message);
  };

  const signInPassword = async () => {
    if (!email || !password) { alert("Fyll i e-post och lösenord"); return; }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };
  const signUpPassword = async () => {
    if (!email || !password) { alert("Fyll i e-post och lösenord"); return; }
    const { error } = await sb.auth.signUp({ email, password });
    if (error) alert(error.message);
  };

  const [machines, setMachines] = useState([]);
  const [locations, setLocations] = useState([]);
  const [placements, setPlacements] = useState([]);

  const loadAll = async () => {
    if (!sb) return;
    const [m, l, p] = await Promise.all([
      sb.from("machines").select("*").order("id"),
      sb.from("locations").select("*").order("id"),
      sb.from("placements").select("*").order("timestamp", { ascending: true })
    ]);
    if (!m.error) setMachines(m.data);
    if (!l.error) setLocations(l.data);
    if (!p.error) setPlacements(p.data);
  };

  useEffect(() => { if (session) loadAll(); }, [session]);

  useEffect(() => {
    if (!sb || !session) return;
    const ch = sb.channel("placements-rt").on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'placements' },
      (payload) => {
        setPlacements((prev) => {
          const next = [...prev];
          if (payload.eventType === 'INSERT') next.push(payload.new);
          return next;
        });
      }
    ).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, session]);

  const latestByMachine = useMemo(() => {
    const map = new Map();
    for (const p of placements) {
      const prev = map.get(p.machine_id);
      if (!prev || new Date(p.timestamp) > new Date(prev.timestamp)) map.set(p.machine_id, p);
    }
    return map;
  }, [placements]);

  const place = async (machine_id, location_id) => {
    if (!isCC(machine_id)) return alert("Maskin-ID måste vara CCxxxx");
    if (!locations.find((l) => l.id === location_id)) return alert("Ogiltig lagerplats");
    const { error } = await sb.from("placements").insert({ machine_id, location_id, user_email: session?.user?.email || "anon" });
    if (error) alert(error.message);
  };

  const addMachine = async (id) => {
    if (!isCC(id)) return alert("ID-format CCxxxx");
    const { error } = await sb.from("machines").insert({ id, status: 'in_use' });
    if (error) alert(error.message); else loadAll();
  };
  const addLocation = async (id) => {
    if (!id) return;
    const { error } = await sb.from("locations").insert({ id, capacity: 1 });
    if (error) alert(error.message); else loadAll();
  };

  const [pendingLocation, setPendingLocation] = useState("");
  const [pendingMachine, setPendingMachine] = useState("");
  const [scanTarget, setScanTarget] = useState(null);

  const onScanLocation = (code) => { setScanTarget(null); setPendingLocation(code); };
  const onScanMachine = (code) => { setScanTarget(null); setPendingMachine(code); place(code, pendingLocation); setPendingMachine(""); setPendingLocation(""); };

  const [qrType, setQrType] = useState('location');
  const [qrInput, setQrInput] = useState('');
  const listIds = useMemo(() => qrInput.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean), [qrInput]);

  if (!sb) {
    return (
      <div className="container">
        <div className="grid" style={{maxWidth:640, margin:"0 auto"}}>
          <h1>CC Lager – Supabase setup</h1>
          <p>Fyll i din Supabase URL och Anon Key för att ansluta, eller sätt <code>VITE_SUPABASE_URL</code> och <code>VITE_SUPABASE_ANON_KEY</code> som miljövariabler vid deploy.</p>
          <input className="input" placeholder="SUPABASE_URL" value={supabaseUrl} onChange={(e)=>setSupabaseUrl(e.target.value)} />
          <input className="input" placeholder="SUPABASE_ANON_KEY" value={supabaseKey} onChange={(e)=>setSupabaseKey(e.target.value)} />
          <p className="muted">Tips: När det funkar, använd miljövariabler i din host för att slippa klistra in varje gång.</p>
        </div>
      </div>
    );
  }

    if (!session) {
    return (
      <div className="container">
        <div className="grid" style={{maxWidth:560, margin:"0 auto"}}>
          <h1>Logga in</h1>
          <input className="input" placeholder="din@epost.se" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <div className="row" style={{marginTop:8}}>
            <button className="btn primary" onClick={signIn}>Skicka magisk länk</button>
          </div>
          <div className="card" style={{marginTop:12}}>
            <strong>Har du en 6-siffrig kod?</strong>
            <div className="row" style={{marginTop:8}}>
              <input className="input" placeholder="Engångskod från e-post" value={otpCode} onChange={(e)=>setOtpCode(e.target.value.trim())} />
              <button className="btn" onClick={verifyOtp}>Verifiera kod</button>
            </div>
            <p className="muted" style={{fontSize:12, marginTop:6}}>Tips: Om länken strular i mailappen kan du klistra in koden här.</p>
          </div>

          <div className="card" style={{marginTop:12}}>
            <div className="row-center" style={{justifyContent:'space-between'}}>
              <strong>{isRegister ? 'Skapa konto med lösenord' : 'Logga in med lösenord'}</strong>
              <button className="btn" onClick={()=>setIsRegister(!isRegister)}>{isRegister ? 'Byt till inloggning' : 'Byt till registrering'}</button>
            </div>
            <div className="row" style={{marginTop:8}}>
              <input className="input" placeholder="Lösenord (minst 6 tecken)" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              {isRegister
                ? <button className="btn" onClick={signUpPassword}>Registrera</button>
                : <button className="btn" onClick={signInPassword}>Logga in</button>}
            </div>
            <p className="muted" style={{fontSize:12, marginTop:6}}>Obs: Kräver att **Email + Password** är aktiverat i Supabase (Auth → Providers).</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="row-center" style={{justifyContent:"space-between"}}>
        <h1>CC Lager – Multiuser</h1>
        <div className="row-center">
          <span className="muted" style={{fontSize:14, marginRight:8}}>{session.user.email}</span>
          <button className="btn" onClick={signOut}>Logga ut</button>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Flytta maskin</h2>
          <div className="grid grid-3">
            <div>
              <label className="muted">Plats-ID</label>
              <div className="row">
                <input className="input" value={pendingLocation} onChange={(e)=>setPendingLocation(e.target.value)} placeholder="t.ex. A3" />
                <button className="btn" onClick={()=>setScanTarget('location')}>Skanna</button>
              </div>
            </div>
            <div>
              <label className="muted">Maskin-ID (CCxxxx)</label>
              <div className="row">
                <input className="input" value={pendingMachine} onChange={(e)=>setPendingMachine(e.target.value)} placeholder="t.ex. CC0012" />
                <button className="btn" onClick={()=>setScanTarget('machine')} disabled={!pendingLocation}>Skanna</button>
              </div>
            </div>
            <div className="row-center" style={{alignItems:"end"}}>
              <button className="btn primary" onClick={()=>{ place(pendingMachine, pendingLocation); setPendingMachine(''); setPendingLocation(''); }}>Registrera</button>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Aktuell plats per maskin</h2>
          <div style={{overflowX:"auto"}}>
            <table>
              <thead>
                <tr><th>Maskin</th><th>Plats</th><th>Senast</th><th>Av</th></tr>
              </thead>
              <tbody>
                {machines.map((m) => {
                  const p = latestByMachine.get(m.id);
                  return (
                    <tr key={m.id}>
                      <td style={{fontWeight:600}}>{m.id}</td>
                      <td>{p?.location_id ?? <span className="muted">–</span>}</td>
                      <td>{p?.timestamp ? new Date(p.timestamp).toLocaleString() : ""}</td>
                      <td>{p?.user_email || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Historik</h2>
          <div style={{overflowX:"auto"}}>
            <table>
              <thead>
                <tr><th>Tid</th><th>Maskin</th><th>Plats</th><th>Användare</th></tr>
              </thead>
              <tbody>
                {[...placements].reverse().map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.timestamp).toLocaleString()}</td>
                    <td>{p.machine_id}</td>
                    <td>{p.location_id}</td>
                    <td>{p.user_email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Generera QR-etiketter</h2>
          <div className="grid grid-3">
            <div>
              <label className="muted">Typ</label>
              <select className="input" value={qrType} onChange={(e)=>setQrType(e.target.value)}>
                <option value="location">Lagerplatser</option>
                <option value="machine">Maskiner (CCxxxx)</option>
              </select>
              <label className="muted" style={{marginTop:8, display:"block"}}>ID-lista (kommaseparerad eller radbruten)</label>
              <textarea className="input" style={{height:120}} placeholder={qrType==='machine' ? 'CC0001, CC0002, ...' : 'A1, A2, A3, ...'} value={qrInput} onChange={(e)=>setQrInput(e.target.value)} />
              <div className="muted" style={{fontSize:12, marginTop:4}}>Tips: För maskiner, använd format CC + 4 siffror.</div>
            </div>
            <div className="grid grid-2" style={{gridColumn:"span 2"}}>
              {listIds.map((id) => (
                <div className="card" key={id}>
                  <QRGen value={id} label={id} />
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{marginTop:12}}>
            <button className="btn" onClick={()=>window.print()}>Skriv ut</button>
            <button className="btn" onClick={async ()=>{
              if (qrType==='machine') {
                const payload = listIds.filter(isCC).map(id => ({ id, status: 'in_use' }));
                if (payload.length) {
                  const { error } = await sb.from('machines').insert(payload, { upsert: true });
                  if (error) alert(error.message); else alert('Maskiner sparade');
                } else {
                  alert("Inga giltiga maskin-ID i format CCxxxx");
                }
              } else {
                const payload = listIds.map(id => ({ id, capacity: 1 }));
                if (payload.length) {
                  const { error } = await sb.from('locations').insert(payload, { upsert: true });
                  if (error) alert(error.message); else alert('Platser sparade');
                }
              }
            }}>Spara dessa ID i databasen</button>
          </div>
        </section>

        <section className="card">
          <h2>Admin</h2>
          <div className="grid grid-2">
            <InlineAdd placeholder="CC0123" onAdd={addMachine} />
            <InlineAdd placeholder="A4 eller FLOOR-07" onAdd={addLocation} />
          </div>
        </section>

        {scanTarget && (
          <Modal title={`Skanna ${scanTarget === 'location' ? 'PLATS' : 'MASKIN'}`} onClose={()=>setScanTarget(null)}>
            <QRScanner onScan={scanTarget==='location' ? onScanLocation : onScanMachine} onClose={()=>setScanTarget(null)} />
          </Modal>
        )}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  useEffect(() => { const onKey = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return (
    <div className="modal">
      <div className="content">
        <div className="row-center" style={{justifyContent:"space-between", marginBottom:8}}>
          <h3>{title}</h3>
          <button className="btn" onClick={onClose}>Stäng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InlineAdd({ placeholder, onAdd }) {
  const [v, setV] = useState("");
  return (
    <div className="row">
      <input className="input" value={v} onChange={(e)=>setV(e.target.value.trim())} placeholder={placeholder} />
      <button className="btn" onClick={()=>{ if (v) { onAdd(v); setV(""); } else { alert('Fyll i ett värde'); } }}>Lägg till</button>
    </div>
  );
}
