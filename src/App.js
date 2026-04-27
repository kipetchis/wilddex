import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "wilddex_v2";
const WORKER_URL  = "https://wilddex-proxy.kip3tchis.workers.dev";

const RARITY = {
  commun:       { label:"Commun",      color:"#78C850", bg:"#e8f5e1", stars:1 },
  "peu commun": { label:"Peu commun",  color:"#4A90D9", bg:"#ddeeff", stars:2 },
  rare:         { label:"Rare",        color:"#9B59B6", bg:"#f0e6ff", stars:3 },
  "très rare":  { label:"Très rare",   color:"#E67E22", bg:"#fff0de", stars:4 },
  légendaire:   { label:"Légendaire",  color:"#E74C3C", bg:"#ffe5e5", stars:5 },
};

const TYPE_ICONS = {
  mammifère:"🐾", oiseau:"🐦", reptile:"🦎", amphibien:"🐸",
  poisson:"🐟", insecte:"🐛", arachnide:"🕷️", mollusque:"🐚",
  crustacé:"🦀", autre:"🌿"
};

const FILTER_TABS = ["Tous","Mammifères","Oiseaux","Insectes","Reptiles","Autres"];
const FILTER_MAP  = { "Mammifères":"mammifère","Oiseaux":"oiseau","Insectes":"insecte","Reptiles":"reptile","Autres":"autre" };

const BADGES_DEF = [
  { id:"curious",      icon:"🔍", name:"Curieux",        desc:"Découvrir 1 animal",   color:"#E67E22", req:c=>c>=1  },
  { id:"observer",     icon:"👁️", name:"Observateur",    desc:"Découvrir 5 animaux",  color:"#3498DB", req:c=>c>=5  },
  { id:"naturalist",   icon:"🌿", name:"Naturaliste",    desc:"Découvrir 10 animaux", color:"#27AE60", req:c=>c>=10 },
  { id:"photographer", icon:"📷", name:"Photographe",    desc:"Prendre 10 photos",    color:"#8E44AD", req:c=>c>=10 },
  { id:"collector",    icon:"📚", name:"Collectionneur", desc:"Découvrir 15 animaux", color:"#C0392B", req:c=>c>=15 },
  { id:"mystery",      icon:"❓", name:"Mystère",        desc:"???",                  color:"#7F8C8D", req:c=>c>=50 },
];

const LOCKED_SLOTS = [
  { name:"Renard" }, { name:"Chevreuil" }, { name:"Martinet" },
];

const SYSTEM_PROMPT = `Tu es WildDex, un naturaliste pour enfants de 6-10 ans.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte avant/après.
Si aucun animal n'est visible: {"erreur":"Aucun animal détecté. Essaie de photographier un animal !"}
Sinon retourne exactement:
{
  "nom":"Nom commun français",
  "nom_scientifique":"Nom scientifique",
  "type":"mammifère|oiseau|reptile|amphibien|poisson|insecte|arachnide|mollusque|crustacé|autre",
  "habitat":"Ex: Forêts, jardins, haies",
  "activite":"Ex: Nocturne ou Diurne",
  "alimentation":"Ce qu'il mange (1 phrase)",
  "description":"2-3 phrases simples et fun pour enfant",
  "fun_fact":"Un fait surprenant et amusant",
  "taille":"Ex: 20 à 30 cm",
  "poids":"Ex: 600 à 1200 g",
  "esperance_vie":"Ex: 2 à 7 ans",
  "rarete":"commun|peu commun|rare|très rare|légendaire"
}`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null"); } catch { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}
function getRarity(key) {
  return RARITY[(key||"commun").toLowerCase()] || RARITY.commun;
}
function computePoints(col) { return col.reduce((a,_,i)=>a+10*(i+1),0); }

async function analyzeImage(base64, mediaType) {
  const res = await fetch(WORKER_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      parts: [
        { inline_data:{ mime_type:mediaType, data:base64 } },
        { text:"Identifie l'animal sur cette photo." }
      ]
    })
  });
  if (!res.ok) throw new Error(`Worker error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const clean = text.replace(/```json|```/g,"").trim();
  return JSON.parse(clean);
}

// ─── BADGE ───────────────────────────────────────────────────────────────────

function Badge({ def, unlocked }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,opacity:unlocked?1:0.4 }}>
      <div style={{
        width:56,height:56,borderRadius:16,
        background:unlocked?`linear-gradient(135deg,${def.color},${def.color}bb)`:"#d0d0d0",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        boxShadow:unlocked?`0 4px 12px ${def.color}55`:"none",
        border:`3px solid ${unlocked?def.color:"#aaa"}`,position:"relative",
      }}>
        {unlocked?def.icon:"🔒"}
        {unlocked&&(
          <div style={{
            position:"absolute",bottom:-4,right:-4,width:16,height:16,borderRadius:"50%",
            background:"#FFD700",border:"2px solid white",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#7B5800"
          }}>✓</div>
        )}
      </div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,color:"#2d3436",textAlign:"center",lineHeight:1.2}}>
        {unlocked?def.name:"???"}
      </div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:600,fontSize:10,color:"#636e72",textAlign:"center",lineHeight:1.2}}>
        {unlocked?def.desc:"???"}
      </div>
    </div>
  );
}

// ─── ANIMAL CARD ─────────────────────────────────────────────────────────────

function AnimalGridCard({ animal, onClick }) {
  const r = getRarity(animal.rarete);
  return (
    <div onClick={onClick} style={{
      borderRadius:18,overflow:"hidden",cursor:"pointer",
      border:`3px solid ${r.color}`,boxShadow:`0 4px 12px ${r.color}33`,
      background:"white",transition:"transform 0.15s, box-shadow 0.15s",position:"relative",
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.boxShadow=`0 8px 20px ${r.color}55`}}
    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow=`0 4px 12px ${r.color}33`}}
    >
      <div style={{height:80,overflow:"hidden"}}>
        <img src={animal.photo} alt={animal.nom} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>
      <div style={{padding:"6px 6px 8px",textAlign:"center"}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:12,color:"#2d3436",lineHeight:1.2}}>
          {animal.nom}
        </div>
        <div style={{fontSize:9,color:r.color,fontFamily:"'Nunito',sans-serif",fontWeight:700,marginTop:2}}>
          {r.label}
        </div>
      </div>
      <div style={{
        position:"absolute",top:6,right:6,background:"rgba(255,215,0,0.9)",
        borderRadius:10,fontSize:10,padding:"1px 5px",
        fontFamily:"'Nunito',sans-serif",fontWeight:900,color:"#7B5800"
      }}>⭐</div>
    </div>
  );
}

function LockedCard({ name }) {
  return (
    <div style={{borderRadius:18,overflow:"hidden",border:"3px solid #ccc",background:"#f0f0f0",opacity:0.7}}>
      <div style={{height:80,display:"flex",alignItems:"center",justifyContent:"center",background:"#e0e0e0"}}>
        <span style={{fontSize:28}}>🔒</span>
      </div>
      <div style={{padding:"6px 6px 8px",textAlign:"center"}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,color:"#aaa"}}>{name}</div>
      </div>
    </div>
  );
}

// ─── HOME ────────────────────────────────────────────────────────────────────

function HomeView({ collection, onScan }) {
  const points = computePoints(collection);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 20px 20px"}}>
      <div style={{
        width:"100%",borderRadius:28,overflow:"hidden",position:"relative",
        background:"linear-gradient(160deg,#5cb85c 0%,#3a9e3a 40%,#2e7d32 100%)",
        marginBottom:20,minHeight:260,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",
        padding:"0 20px 24px",
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,overflow:"hidden"}}>
          {["🌳","🌲","🌿","🌻","🦋"].map((e,i)=>(
            <span key={i} style={{
              position:"absolute",fontSize:[40,34,24,20,18][i],opacity:0.35,
              top:["-5%","0%","10%","5%","20%"][i],
              left:["-2%","75%","15%","55%","85%"][i],
              animation:`sway${i%2} ${3+i}s ease-in-out infinite`,
            }}>{e}</span>
          ))}
        </div>
        <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
          <div style={{fontSize:70,lineHeight:1,marginBottom:4,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.2))"}}>🦊</div>
          <h1 style={{
            margin:"0 0 4px",fontFamily:"'Fredoka One',cursive",fontSize:42,color:"white",
            textShadow:"0 3px 0 rgba(0,0,0,0.2)",letterSpacing:1,
          }}><span style={{color:"#FFD700"}}>Wild</span>Dex</h1>
          <p style={{margin:"0 0 20px",fontFamily:"'Nunito',sans-serif",fontWeight:700,color:"rgba(255,255,255,0.9)",fontSize:14}}>
            Explore, découvre et collectionne<br/>les animaux autour de toi !
          </p>
          <button onClick={onScan} style={{
            background:"linear-gradient(135deg,#FFD700,#FFA500)",
            border:"none",borderRadius:50,padding:"14px 36px",
            fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#7B3F00",
            cursor:"pointer",boxShadow:"0 6px 20px rgba(0,0,0,0.25)",
            display:"flex",alignItems:"center",gap:10,
            animation:"pulse 2s ease-in-out infinite",
          }}>
            <span style={{fontSize:22}}>📷</span> Scanner un animal
          </button>
        </div>
      </div>

      <div style={{width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {icon:"🐾",val:collection.length,label:"Découverts"},
          {icon:"⭐",val:points,label:"Points"},
          {icon:"🏆",val:BADGES_DEF.filter(b=>b.req(collection.length)).length,label:"Badges"},
        ].map(({icon,val,label})=>(
          <div key={label} style={{
            background:"white",borderRadius:18,padding:"12px 8px",textAlign:"center",
            boxShadow:"0 4px 12px rgba(0,0,0,0.06)",border:"2px solid #e8f5e1",
          }}>
            <div style={{fontSize:22}}>{icon}</div>
            <div style={{fontFamily:"'Fredoka One',cursive",fontSize:24,color:"#2e7d32"}}>{val}</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:11,color:"#636e72"}}>{label}</div>
          </div>
        ))}
      </div>

      {collection.length>0&&(
        <div style={{width:"100%"}}>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#2d3436",marginBottom:12}}>
            🌟 Dernières découvertes
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            {collection.slice(0,3).map((a,i)=>(
              <AnimalGridCard key={i} animal={a} onClick={()=>{}}/>
            ))}
          </div>
        </div>
      )}

      <div style={{marginTop:24,width:"100%",display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{fontSize:40,flexShrink:0}}>🦊</div>
        <div style={{
          background:"white",borderRadius:18,borderTopLeftRadius:4,padding:"12px 16px",
          fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:"#2d3436",
          boxShadow:"0 4px 12px rgba(0,0,0,0.07)",border:"2px solid #e8f5e1",
        }}>
          Continue tes découvertes et deviens un vrai expert de la nature ! 🐾
        </div>
      </div>
    </div>
  );
}

// ─── SCAN ────────────────────────────────────────────────────────────────────

function ScanView({ onBack, onResult }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!preview||loading) return;
    setLoading(true); setError(null);
    try {
      const base64    = preview.split(",")[1];
      const mediaType = preview.split(";")[0].split(":")[1];
      const parsed    = await analyzeImage(base64, mediaType);
      if (parsed.erreur) { setError(parsed.erreur); setLoading(false); return; }
      onResult({ ...parsed, photo:preview, date:new Date().toLocaleDateString("fr-FR") });
    } catch(e) {
      setError("Oups ! Une erreur s'est produite. Réessaie !");
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div style={{padding:20,display:"flex",flexDirection:"column",gap:16,alignItems:"center"}}>
      <h2 style={{fontFamily:"'Fredoka One',cursive",fontSize:26,color:"#2d3436",margin:0}}>
        📷 Scanner un animal
      </h2>

      <div style={{
        width:"100%",maxWidth:340,aspectRatio:"4/3",
        borderRadius:24,overflow:"hidden",position:"relative",
        background:preview?"black":"linear-gradient(135deg,#1a1a2e,#16213e)",
        border:"3px solid #5cb85c",boxShadow:"0 8px 32px rgba(92,184,92,0.3)",
        cursor:preview?"default":"pointer",
      }} onClick={!preview?()=>inputRef.current?.click():undefined}>
        {preview
          ? <img src={preview} alt="preview" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : (
            <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
              {[{top:20,left:20},{top:20,right:20},{bottom:20,left:20},{bottom:20,right:20}].map((pos,i)=>(
                <div key={i} style={{
                  position:"absolute",...pos,width:28,height:28,
                  borderTop:   i<2 ?"4px solid #5cb85c":"none",
                  borderBottom:i>=2?"4px solid #5cb85c":"none",
                  borderLeft:  (i===0||i===2)?"4px solid #5cb85c":"none",
                  borderRight: (i===1||i===3)?"4px solid #5cb85c":"none",
                }}/>
              ))}
              <span style={{fontSize:48,opacity:0.6}}>🦎</span>
              <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,color:"rgba(255,255,255,0.7)",fontSize:14}}>
                Touche pour choisir une photo
              </span>
            </div>
          )
        }

        {loading&&(
          <div style={{
            position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,
          }}>
            <div style={{fontSize:48,animation:"spin 1s linear infinite"}}>🔍</div>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,color:"white",fontSize:16}}>
              WildDex analyse...
            </div>
            <div style={{
              position:"absolute",left:0,right:0,height:3,
              background:"linear-gradient(90deg,transparent,#5cb85c,transparent)",
              animation:"scan 1.5s ease-in-out infinite",
            }}/>
          </div>
        )}

        {preview&&!loading&&(
          <button onClick={e=>{e.stopPropagation();setPreview(null);setError(null);}} style={{
            position:"absolute",top:10,right:10,
            background:"rgba(0,0,0,0.6)",color:"white",border:"none",
            borderRadius:20,padding:"4px 12px",cursor:"pointer",
            fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,
          }}>✕</button>
        )}
      </div>

      {!preview&&(
        <div style={{
          background:"rgba(92,184,92,0.1)",border:"2px solid #5cb85c33",
          borderRadius:14,padding:"10px 16px",
          fontFamily:"'Nunito',sans-serif",fontWeight:700,color:"#2e7d32",fontSize:13,
        }}>
          💡 Conseil : rapproche-toi doucement de l'animal !
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        style={{display:"none"}} onChange={handleFile}/>

      <div style={{display:"flex",gap:12,width:"100%",maxWidth:340}}>
        {!preview?(
          <>
            <button onClick={()=>inputRef.current?.click()} style={{
              flex:1,background:"white",border:"3px solid #5cb85c",borderRadius:20,
              padding:"14px",cursor:"pointer",fontSize:22,
              boxShadow:"0 4px 12px rgba(0,0,0,0.08)",
            }}>🖼️</button>
            <button onClick={()=>inputRef.current?.click()} style={{
              flex:3,background:"linear-gradient(135deg,#5cb85c,#3a9e3a)",
              border:"none",borderRadius:20,padding:"14px",
              fontFamily:"'Fredoka One',cursive",fontSize:18,color:"white",
              cursor:"pointer",boxShadow:"0 4px 16px rgba(92,184,92,0.4)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            }}>
              <span style={{fontSize:20}}>📷</span> Prendre une photo
            </button>
          </>
        ):(
          <button onClick={analyze} disabled={loading} style={{
            flex:1,
            background:loading?"#aaa":"linear-gradient(135deg,#FFD700,#FFA500)",
            border:"none",borderRadius:20,padding:"16px",
            fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#7B3F00",
            cursor:loading?"not-allowed":"pointer",
            boxShadow:"0 4px 16px rgba(255,165,0,0.4)",
            animation:loading?"none":"pulse 1.5s infinite",
          }}>
            {loading?"Analyse en cours...":"🔍 Identifier !"}
          </button>
        )}
      </div>

      {error&&(
        <div style={{
          background:"#fff3cd",border:"2px solid #ffc107",borderRadius:16,
          padding:"12px 16px",fontFamily:"'Nunito',sans-serif",fontWeight:700,
          color:"#856404",fontSize:14,maxWidth:340,textAlign:"center",
        }}>⚠️ {error}</div>
      )}

      <button onClick={onBack} style={{
        background:"none",border:"2px solid #ddd",borderRadius:20,
        padding:"10px 24px",fontFamily:"'Nunito',sans-serif",fontWeight:700,
        color:"#636e72",cursor:"pointer",fontSize:14,
      }}>← Retour</button>
    </div>
  );
}

// ─── RESULT / DETAIL ─────────────────────────────────────────────────────────

function ResultView({ animal, isNew, onSave, onBack }) {
  const r = getRarity(animal.rarete);
  const [shown,    setShown]    = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(()=>{ setTimeout(()=>setShown(true),60); },[]);

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const utt = new SpeechSynthesisUtterance(
      `${animal.nom}. ${animal.description} Le savais-tu ? ${animal.fun_fact}`
    );
    utt.lang="fr-FR"; utt.rate=0.9;
    utt.onend=()=>setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utt);
  };

  return (
    <div style={{
      padding:20,
      opacity:shown?1:0,transform:shown?"translateY(0)":"translateY(30px)",
      transition:"all 0.4s ease",
    }}>
      {isNew&&(
        <div style={{
          background:"linear-gradient(135deg,#FFD700,#FFA500)",color:"#7B3F00",
          borderRadius:20,padding:"12px 20px",
          fontFamily:"'Fredoka One',cursive",fontSize:20,
          textAlign:"center",marginBottom:16,
          boxShadow:"0 4px 16px rgba(255,165,0,0.4)",
        }}>🎉 Bravo ! Tu as découvert</div>
      )}

      <div style={{background:"white",borderRadius:28,overflow:"hidden",border:`4px solid ${r.color}`,boxShadow:`0 8px 32px ${r.color}33`}}>
        <div style={{position:"relative"}}>
          <img src={animal.photo} alt={animal.nom} style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}}/>
          <div style={{
            position:"absolute",top:12,right:12,background:r.color,color:"white",
            fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:12,
            padding:"4px 14px",borderRadius:20,
          }}>{r.label}</div>
        </div>

        <div style={{padding:20}}>
          <div style={{marginBottom:12}}>
            <h2 style={{margin:"0 0 4px",fontFamily:"'Fredoka One',cursive",fontSize:28,color:"#2d3436"}}>
              {TYPE_ICONS[animal.type?.toLowerCase()]||"🐾"} {animal.nom}
            </h2>
            <div style={{fontFamily:"'Nunito',sans-serif",color:"#636e72",fontSize:12,fontStyle:"italic"}}>
              {animal.nom_scientifique}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            {[
              {icon:"🏷️",label:"Type",        val:animal.type},
              {icon:"🏡",label:"Habitat",      val:animal.habitat},
              {icon:"🌙",label:"Activité",     val:animal.activite},
              {icon:"🍽️",label:"Alimentation", val:animal.alimentation},
              {icon:"📏",label:"Taille",       val:animal.taille},
              {icon:"⚖️",label:"Poids",        val:animal.poids},
              {icon:"⏳",label:"Espérance",    val:animal.esperance_vie},
              {icon:"📅",label:"Capturé",      val:animal.date},
            ].map(({icon,label,val})=>(
              <div key={label} style={{background:"#f8f9fa",borderRadius:12,padding:"8px 10px",border:"1.5px solid #eee"}}>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,color:"#636e72",fontSize:10,marginBottom:2}}>
                  {icon} {label.toUpperCase()}
                </div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,color:"#2d3436",fontSize:12,lineHeight:1.3}}>
                  {val||"—"}
                </div>
              </div>
            ))}
          </div>

          <div style={{background:r.bg,borderRadius:16,padding:14,marginBottom:10,border:`1.5px solid ${r.color}33`}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,color:r.color,fontSize:12,marginBottom:6}}>
              📖 DESCRIPTION
            </div>
            <p style={{margin:0,fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#2d3436",lineHeight:1.7}}>
              {animal.description}
            </p>
          </div>

          <div style={{background:"#fff9e6",borderRadius:16,padding:14,border:"2px solid #FFD700",marginBottom:14}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,color:"#e67e22",fontSize:12,marginBottom:6}}>
              ⭐ LE SAIS-TU ?
            </div>
            <p style={{margin:0,fontFamily:"'Nunito',sans-serif",fontSize:13,color:"#2d3436",lineHeight:1.7}}>
              {animal.fun_fact}
            </p>
          </div>

          <button onClick={speak} style={{
            width:"100%",padding:"12px",
            background:speaking?"#e74c3c":"linear-gradient(135deg,#3498db,#2980b9)",
            border:"none",borderRadius:16,
            fontFamily:"'Fredoka One',cursive",fontSize:16,color:"white",
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            boxShadow:"0 4px 12px rgba(52,152,219,0.35)",marginBottom:10,
          }}>
            <span>{speaking?"⏹️":"🔊"}</span>
            {speaking?"Arrêter":"Écouter la description"}
          </button>

          <div style={{display:"grid",gridTemplateColumns:isNew?"1fr 1fr":"1fr",gap:10}}>
            {isNew&&(
              <button onClick={onSave} style={{
                padding:"12px",background:"linear-gradient(135deg,#5cb85c,#3a9e3a)",
                border:"none",borderRadius:16,fontFamily:"'Fredoka One',cursive",
                fontSize:15,color:"white",cursor:"pointer",
                boxShadow:"0 4px 12px rgba(92,184,92,0.4)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              }}>⭐ Ma collection</button>
            )}
            <button onClick={onBack} style={{
              padding:"12px",background:"white",border:"2px solid #ddd",
              borderRadius:16,fontFamily:"'Fredoka One',cursive",
              fontSize:15,color:"#636e72",cursor:"pointer",
            }}>← Retour</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COLLECTION ───────────────────────────────────────────────────────────────

function CollectionView({ collection, onAnimalClick }) {
  const [filter, setFilter] = useState("Tous");
  const filtered = filter==="Tous"
    ? collection
    : collection.filter(a=>(a.type||"").toLowerCase()===(FILTER_MAP[filter]||""));

  return (
    <div style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <h2 style={{margin:0,fontFamily:"'Fredoka One',cursive",fontSize:24,color:"#2d3436"}}>Ma collection</h2>
        <div style={{background:"#FFD700",borderRadius:20,padding:"4px 12px",fontFamily:"'Fredoka One',cursive",fontSize:16,color:"#7B3F00",display:"flex",alignItems:"center",gap:4}}>
          ⭐ {computePoints(collection)}
        </div>
      </div>
      <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,color:"#636e72",fontSize:13,marginBottom:16}}>
        {collection.length} / ∞ animaux découverts
      </div>

      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {FILTER_TABS.map(tab=>(
          <button key={tab} onClick={()=>setFilter(tab)} style={{
            flexShrink:0,
            background:filter===tab?"#5cb85c":"white",
            color:filter===tab?"white":"#2d3436",
            border:filter===tab?"2px solid #5cb85c":"2px solid #e0e0e0",
            borderRadius:20,padding:"6px 14px",
            fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:13,
            cursor:"pointer",transition:"all 0.15s",
          }}>{tab}</button>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        {filtered.map((a,i)=>(
          <AnimalGridCard key={i} animal={a} onClick={()=>onAnimalClick(a)}/>
        ))}
        {filter==="Tous"&&LOCKED_SLOTS.map((s,i)=>(
          <LockedCard key={"locked"+i} name={s.name}/>
        ))}
      </div>

      {collection.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0"}}>
          <div style={{fontSize:60}}>🦎</div>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:18,color:"#ccc",marginTop:8}}>
            Scanne ton premier animal !
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BADGES ──────────────────────────────────────────────────────────────────

function BadgesView({ collection }) {
  const count   = collection.length;
  const points  = computePoints(collection);
  const unlocked = BADGES_DEF.filter(b=>b.req(count));

  return (
    <div style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontFamily:"'Fredoka One',cursive",fontSize:24,color:"#2d3436"}}>Mes badges</h2>
        <div style={{background:"#FFD700",borderRadius:20,padding:"4px 12px",fontFamily:"'Fredoka One',cursive",fontSize:16,color:"#7B3F00",display:"flex",alignItems:"center",gap:4}}>
          ⭐ {points}
        </div>
      </div>

      {unlocked.length>0&&(
        <div style={{
          background:"linear-gradient(135deg,#f8f9fa,#eefce8)",borderRadius:24,padding:24,
          display:"flex",flexDirection:"column",alignItems:"center",gap:8,
          border:"2px solid #5cb85c33",marginBottom:20,
          boxShadow:"0 4px 16px rgba(92,184,92,0.1)",
        }}>
          <div style={{
            width:80,height:80,borderRadius:24,
            background:`linear-gradient(135deg,${unlocked[unlocked.length-1].color},${unlocked[unlocked.length-1].color}bb)`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,
            boxShadow:`0 8px 24px ${unlocked[unlocked.length-1].color}55`,
            border:`4px solid ${unlocked[unlocked.length-1].color}`,
          }}>{unlocked[unlocked.length-1].icon}</div>
          <div style={{fontFamily:"'Fredoka One',cursive",fontSize:20,color:"#2d3436"}}>
            {unlocked[unlocked.length-1].name}
          </div>
          <div style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,color:"#636e72",textAlign:"center"}}>
            {unlocked[unlocked.length-1].desc}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {BADGES_DEF.map(def=>(
          <Badge key={def.id} def={def} unlocked={def.req(count)}/>
        ))}
      </div>

      <div style={{marginTop:24,background:"white",borderRadius:20,padding:16,border:"2px solid #eee"}}>
        <div style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:"#2d3436",marginBottom:10}}>
          📊 Progression
        </div>
        {[
          {label:"Animaux découverts",val:count,max:50},
          {label:"Badges débloqués",val:unlocked.length,max:BADGES_DEF.length},
        ].map(({label,val,max})=>(
          <div key={label} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:12,color:"#636e72"}}>{label}</span>
              <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:12,color:"#5cb85c"}}>{val}/{max}</span>
            </div>
            <div style={{height:8,borderRadius:4,background:"#eee",overflow:"hidden"}}>
              <div style={{
                height:"100%",borderRadius:4,
                background:"linear-gradient(90deg,#5cb85c,#3a9e3a)",
                width:`${Math.min(100,(val/max)*100)}%`,
                transition:"width 0.5s ease",
              }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function WildDex() {
  const initial = loadState() || { collection:[] };
  const [collection, setCollection] = useState(initial.collection);
  const [tab,      setTab]      = useState("home");
  const [view,     setView]     = useState("main");
  const [pending,  setPending]  = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(()=>{ saveState({ collection }); }, [collection]);

  const saveAnimal = useCallback((a) => {
    setCollection(prev=>[a,...prev]);
    setPending(null);
    setView("main");
    setTab("collection");
  }, []);

  const TABS = [
    {id:"home",       icon:"🏠", label:"Accueil"},
    {id:"collection", icon:"📚", label:"Collection"},
    {id:"badges",     icon:"⭐", label:"Badges"},
  ];

  const renderMain = () => {
    if (tab==="home")       return <HomeView collection={collection} onScan={()=>setView("scan")}/>;
    if (tab==="collection") return <CollectionView collection={collection} onAnimalClick={a=>{setSelected(a);setView("detail");}}/>;
    if (tab==="badges")     return <BadgesView collection={collection}/>;
  };

  return (
    <div style={{
      minHeight:"100vh",maxWidth:480,margin:"0 auto",
      background:"linear-gradient(160deg,#f0faf0 0%,#e8f5e9 50%,#f0f9ff 100%)",
      position:"relative",fontFamily:"'Nunito',sans-serif",
      display:"flex",flexDirection:"column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#c8e6c9;border-radius:2px;}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes bounce{0%{transform:translateY(0)}30%{transform:translateY(-12px)}60%{transform:translateY(-6px)}100%{transform:translateY(0)}}
        @keyframes sway0{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes sway1{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-2deg)}}
        @keyframes scan{0%{top:0%}50%{top:95%}100%{top:0%}}
      `}</style>

      {view==="main"&&(
        <div style={{
          background:"linear-gradient(135deg,#5cb85c,#3a9e3a)",
          padding:"14px 20px",
          display:"flex",alignItems:"center",justifyContent:"space-between",
          boxShadow:"0 3px 16px rgba(92,184,92,0.25)",
          position:"sticky",top:0,zIndex:20,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:28,animation:"bounce 3s ease-in-out infinite"}}>🌿</span>
            <span style={{fontFamily:"'Fredoka One',cursive",fontSize:22,color:"white",letterSpacing:0.5}}>
              <span style={{color:"#FFD700"}}>Wild</span>Dex
            </span>
          </div>
          <div style={{background:"rgba(255,255,255,0.2)",borderRadius:20,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>⭐</span>
            <span style={{fontFamily:"'Fredoka One',cursive",fontSize:16,color:"white"}}>
              {computePoints(collection)}
            </span>
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",paddingBottom:view==="main"?80:20}}>
        {view==="main"   && renderMain()}
        {view==="scan"   && <ScanView onBack={()=>setView("main")} onResult={a=>{setPending(a);setView("result");}}/>}
        {view==="result" && pending && (
          <ResultView
            animal={pending} isNew={true}
            onSave={()=>saveAnimal(pending)}
            onBack={()=>{setPending(null);setView("main");}}
          />
        )}
        {view==="detail" && selected && (
          <ResultView
            animal={selected} isNew={false}
            onBack={()=>{setSelected(null);setView("main");}}
          />
        )}
      </div>

      {view==="main"&&(
        <div style={{
          position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
          width:"100%",maxWidth:480,
          background:"white",borderTop:"2px solid #e8f5e1",
          display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
          boxShadow:"0 -4px 20px rgba(0,0,0,0.08)",zIndex:20,
        }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background:"none",border:"none",cursor:"pointer",
              padding:"10px 0 12px",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              borderTop:tab===t.id?"3px solid #5cb85c":"3px solid transparent",
            }}>
              <span style={{fontSize:22,transition:"transform 0.15s",transform:tab===t.id?"scale(1.2)":"scale(1)"}}>
                {t.icon}
              </span>
              <span style={{fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:11,color:tab===t.id?"#5cb85c":"#aaa"}}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {view==="main"&&(tab==="home"||tab==="collection")&&(
        <button onClick={()=>setView("scan")} style={{
          position:"fixed",bottom:76,right:20,
          width:60,height:60,borderRadius:"50%",
          background:"linear-gradient(135deg,#FFD700,#FFA500)",
          border:"none",cursor:"pointer",fontSize:26,
          boxShadow:"0 6px 20px rgba(255,165,0,0.45)",
          animation:"pulse 2s ease-in-out infinite",
          display:"flex",alignItems:"center",justifyContent:"center",
          zIndex:15,
        }}>📷</button>
      )}
    </div>
  );
}
