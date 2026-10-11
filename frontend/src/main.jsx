import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Database,
  GitBranch, Hash, Heart, Layers3, Search, Sparkles, Star, Target, Zap,
  RefreshCw, GraduationCap, Cpu, Clock3, AlertCircle
} from 'lucide-react';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const FALLBACK_GENRES = ['Action','Adventure','Animation','Children','Comedy','Crime','Documentary','Drama','Fantasy','Horror','Mystery','Romance','Sci-Fi','Thriller','War','Western'];

function App() {
  const [userId, setUserId] = useState(1);
  const [k, setK] = useState(5);
  const [genres, setGenres] = useState(['Sci-Fi', 'Drama']);
  const [availableGenres, setAvailableGenres] = useState(FALLBACK_GENRES);
  const [recommendations, setRecommendations] = useState([]);
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState('recommend');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API}${url}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }, []);

  const loadInitial = useCallback(async () => {
    setError('');
    try {
      const [s, i, u, g] = await Promise.all([
        request('/stats'), request('/items?limit=50'), request('/users'), request('/genres')
      ]);
      setStats(s); setItems(Array.isArray(i) ? i : []); setUsers(Array.isArray(u) ? u : []);
      if (Array.isArray(g) && g.length) setAvailableGenres(g);
    } catch (e) {
      setError(`${e.message}. Check that the backend is running at ${API}.`);
    }
  }, [request]);

  const generate = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      await request('/preferences', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId, genres, tags: []}) });
      const data = await request('/recommend', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId, k, genres, tags: []}) });
      setRecommendations(data.recommendations || []);
      setNotice(`Generated ${data.recommendations?.length || 0} recommendations for ${users.find(u => Number(u.id) === Number(userId))?.name || `User ${userId}`}.`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [request, userId, genres, k, users]);

  useEffect(() => { loadInitial(); }, [loadInitial]);
  useEffect(() => { if (users.length) generate(); }, [users.length]);

  function toggleGenre(value) {
    setGenres(previous => previous.includes(value) ? previous.filter(x => x !== value) : [...previous, value]);
  }

  async function doSearch(event) {
    event.preventDefault();
    if (!search.trim()) return;
    setError(''); setActive('search'); setSearchResult(null);
    try { setSearchResult(await request(`/search?q=${encodeURIComponent(search.trim())}`)); }
    catch (e) { setError(e.message); }
  }

  async function likeMovie(movieId) {
    setError(''); setNotice('');
    try {
      await request('/interactions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({userId, movieId, interactionType:'like'}) });
      setNotice('Like saved to MySQL. Refreshing recommendations…');
      await generate();
    } catch (e) { setError(e.message); }
  }

  async function loadCatalog() {
    setCatalogLoading(true); setError('');
    try {
      const result = await request(`/items?limit=50&q=${encodeURIComponent(search.trim())}`);
      setItems(Array.isArray(result) ? result : []);
    } catch (e) { setError(e.message); }
    finally { setCatalogLoading(false); }
  }

  const currentUser = users.find(u => Number(u.id) === Number(userId));
  const countLabel = useMemo(() => stats ? `${Number(stats.items).toLocaleString()} titles in MySQL` : 'Connecting to database…', [stats]);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" onClick={() => setActive('recommend')}>
        <span className="brand-mark"><Sparkles size={20}/></span>
        <span><strong>RecomGraph</strong><small>DSA LAB · PROJECT 03</small></span>
      </a>
      <div className="side-label">YOUR WORKSPACE</div>
      <nav className="side-nav">
        <NavButton active={active==='recommend'} onClick={() => setActive('recommend')} icon={<Target/>}>Recommendations</NavButton>
        <NavButton active={active==='search'} onClick={() => setActive('search')} icon={<Search/>}>Movie search</NavButton>
        <NavButton active={active==='dataset'} onClick={() => setActive('dataset')} icon={<Database/>}>Dataset explorer</NavButton>
        <NavButton active={active==='viva'} onClick={() => setActive('viva')} icon={<GraduationCap/>}>DSA viva mode</NavButton>
      </nav>
      <div className="side-divider" />
      <div className="side-label">ALGORITHM STACK</div>
      <div className="algorithm-mini"><span><Hash/></span><div><b>Hash map</b><small>Average O(1) lookup</small></div></div>
      <div className="algorithm-mini"><span><GitBranch/></span><div><b>Weighted graph</b><small>Genre-based links</small></div></div>
      <div className="algorithm-mini"><span><Layers3/></span><div><b>Min-heap</b><small>Top-K candidates</small></div></div>
      <div className="sidebar-bottom"><span className="online-dot"/> <span>Local API workspace</span><small>React · Express · MySQL</small></div>
    </aside>

    <main className="main-content" id="top">
      <header className="page-header">
        <div><div className="eyebrow"><span className="eyebrow-line"/> DATA STRUCTURES & ALGORITHMS — 3</div><h1>{active==='viva' ? 'Explain the engine.' : active==='search' ? 'Find your next film.' : active==='dataset' ? 'The catalogue.' : 'Recommendations, reasoned.'}</h1><p className="page-subtitle">{active==='viva' ? 'A viva-ready walkthrough of the algorithms, complexity, and trade-offs.' : 'A database-backed movie recommender built around a practical DSA pipeline.'}</p></div>
        <form onSubmit={doSearch} className="global-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search 87K+ movie titles…" aria-label="Search movie titles"/><button type="submit">Search <ArrowRight size={15}/></button></form>
      </header>

      {error && <div className="alert error-alert"><AlertCircle size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="alert notice-alert"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

      <section className="metrics-grid">
        <Metric icon={<Database/>} label="MOVIE CATALOGUE" value={stats ? Number(stats.items).toLocaleString() : '—'} detail={countLabel}/>
        <Metric icon={<Hash/>} label="FAST LOOKUP" value="O(1) avg" detail="Hash map / indexed IDs"/>
        <Metric icon={<GitBranch/>} label="RELATIONSHIP MODEL" value="Graph" detail="Weighted by shared genres"/>
        <Metric icon={<Zap/>} label="RANKING STRATEGY" value="Top-K heap" detail="O(N log K) selection"/>
      </section>

      {active === 'recommend' && <>
        <section className="hero-strip"><div className="hero-orb"><Sparkles size={26}/></div><div><span className="hero-kicker">PERSONALIZATION WORKBENCH</span><h2>Tell us what you like. We'll rank what fits.</h2><p>Choose a profile and genres, then watch the DSA pipeline score candidate movies.</p></div><div className="hero-pill"><span className="online-dot"/> DATABASE CONNECTED WHEN API IS HEALTHY</div></section>
        <section className="work-grid">
          <div className="surface preference-panel">
            <div className="section-heading"><div><span className="step-label">01 / INPUT</span><h2>Build a taste profile</h2></div><span className="heading-icon"><Activity size={18}/></span></div>
            <label className="field-label">DEMO USER<select value={userId} onChange={e => setUserId(Number(e.target.value))}>{users.map(user => <option key={user.id} value={user.id}>{user.name} · User {user.id}</option>)}</select></label>
            <div className="field-label count-field"><span>NUMBER OF RESULTS</span><div className="stepper"><button onClick={() => setK(Math.max(1, k-1))} type="button" aria-label="Decrease results">−</button><strong>{k}</strong><button onClick={() => setK(Math.min(10, k+1))} type="button" aria-label="Increase results">+</button></div></div>
            <div className="genre-heading"><span className="field-label">PREFERRED GENRES</span><span>{genres.length} selected</span></div>
            <div className="genre-chips">{availableGenres.map(genre => <button type="button" key={genre} className={`genre-chip ${genres.includes(genre) ? 'chosen' : ''}`} onClick={() => toggleGenre(genre)}>{genres.includes(genre) && <CheckCircle2 size={13}/>} {genre}</button>)}</div>
            <button className="primary-button" disabled={loading || !users.length} onClick={generate}>{loading ? <span className="spinner"/> : <Sparkles size={17}/>} {loading ? 'Building recommendation…' : 'Generate recommendations'} <ChevronRight size={17}/></button>
            <p className="helper-text">Preferences are saved through the API to your MySQL database.</p>
          </div>

          <div className="surface pipeline-panel"><div className="section-heading"><div><span className="step-label">02 / DECISION PIPELINE</span><h2>Inside the engine</h2></div><span className="live-badge"><span className="online-dot"/> LIVE FLOW</span></div>
            <PipelineRow n="01" icon={<Database/>} title="Retrieve profile" text="Load user preferences and liked movies from MySQL." tag="DATA ACCESS"/>
            <PipelineRow n="02" icon={<GitBranch/>} title="Build relevant graph" text="Connect candidate movies through shared genres." tag="GRAPH"/>
            <PipelineRow n="03" icon={<Target/>} title="Calculate a score" text="Combine genre Jaccard similarity, graph weight, rating and popularity." tag="SCORING"/>
            <PipelineRow n="04" icon={<Zap/>} title="Keep the best K" text="A min-heap retains the strongest candidates as we scan the catalogue." tag="TOP-K" last/>
          </div>
        </section>

        <section className="results-section"><div className="section-heading results-heading"><div><span className="step-label">03 / RANKED OUTPUT</span><h2>Your recommendation shortlist</h2><p>Each result includes a score signal and a short explanation.</p></div><div className="results-count"><strong>{recommendations.length.toString().padStart(2,'0')}</strong><span>RESULTS<br/>FOR {currentUser?.name?.toUpperCase() || 'USER'}</span></div></div>
          {recommendations.length ? <div className="recommendation-grid">{recommendations.map((item, index) => <RecommendationCard key={item.id} item={item} index={index} onLike={() => likeMovie(item.id)}/>)}</div> : <div className="empty-state"><span><Sparkles size={22}/></span><h3>Your shortlist will appear here</h3><p>Select a profile and genres, then generate recommendations.</p></div>}
        </section>
      </>}

      {active === 'search' && <section className="surface page-surface"><div className="section-heading"><div><span className="step-label">DSA MODULE / SEARCH</span><h2>Title search explorer</h2><p>Search uses normalized title keys, binary search for an exact match, and matching logic to show related titles.</p></div><span className="heading-icon"><Search size={18}/></span></div>
        {searchResult ? <><div className="search-summary"><div><span className="summary-label">EXACT MATCH</span><strong>{searchResult.result?.title || 'No exact match found'}</strong></div><span className="summary-chip">{searchResult.matches?.length || 0} matching titles</span></div><div className="search-results-list">{(searchResult.matches || []).map((item, index) => <div className="search-row" key={item.id}><span className="search-rank">{String(index+1).padStart(2,'0')}</span><div><strong>{item.title}</strong><small>{item.year || 'Year unavailable'} · {item.genres?.join(' · ') || 'Genres unavailable'}</small></div><span className="movie-id">ID {item.id}</span></div>)}</div></> : <div className="empty-state"><span><Search size={22}/></span><h3>Try a title</h3><p>Search for “Interstellar”, “Toy Story”, “The Matrix”, or another MovieLens title.</p></div>}
      </section>}

      {active === 'dataset' && <section className="surface page-surface"><div className="section-heading"><div><span className="step-label">DATA SOURCE / MOVIELENS</span><h2>Explore the catalogue</h2><p>The catalogue is stored in MySQL; these rows are requested from the Express API.</p></div><button className="secondary-button" onClick={loadCatalog} disabled={catalogLoading}>{catalogLoading ? <span className="spinner dark-spinner"/> : <RefreshCw size={15}/>} Refresh catalogue</button></div><div className="table-meta"><span>{items.length} rows in this view</span><span>Sorted by backend query</span></div><div className="table-container"><table><thead><tr><th>Movie title</th><th>Release year</th><th>Genres</th><th>Dataset ID</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.title}</strong></td><td>{item.year || '—'}</td><td><div className="table-genres">{item.genres?.length ? item.genres.map(g => <span key={g}>{g}</span>) : <span>Not listed</span>}</div></td><td><span className="movie-id">#{item.id}</span></td></tr>)}</tbody></table>{!items.length && <div className="empty-state"><p>No catalogue rows loaded yet.</p></div>}</div></section>}

      {active === 'viva' && <VivaGuide/>}
      <footer className="page-footer"><span>RECOMGRAPH / DSA-3</span><span>MovieLens · React · Express · MySQL</span><span>Built for demonstration and viva</span></footer>
    </main>
  </div>;
}

function NavButton({active, onClick, icon, children}) { return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{children}</span>{active && <ChevronRight size={15} className="nav-arrow"/>}</button>; }
function Metric({icon,label,value,detail}) { return <article className="metric-card"><div className="metric-icon">{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function PipelineRow({n,icon,title,text,tag,last}) { return <div className={`pipeline-row ${last ? 'last' : ''}`}><div className="pipeline-index">{n}</div><div className="pipeline-icon">{icon}</div><div className="pipeline-copy"><h3>{title}</h3><p>{text}</p></div><span className="pipeline-tag">{tag}</span></div>; }
function RecommendationCard({item,index,onLike}) { return <article className="recommendation-card"><div className="recommendation-top"><span className="rank-chip">RANK {String(index+1).padStart(2,'0')}</span>{item.rating ? <span className="rating-chip"><Star size={13} fill="currentColor"/> {item.rating}</span> : <span className="rating-chip muted">DATASET PICK</span>}</div><h3>{item.title}</h3><p className="movie-meta">{item.year || 'Year unavailable'} <span/> {item.genres?.join(' · ') || 'Genre not listed'}</p><p className="recommendation-reason">{item.explanation || 'Selected from your current preference profile.'}</p>{item.matchPercent != null && <div className="match-block"><div><span>RELATIVE MATCH SIGNAL</span><strong>{item.matchPercent}%</strong></div><div className="match-track"><i style={{width:`${item.matchPercent}%`}}/></div></div>}{onLike && <button className="like-button" onClick={onLike}><Heart size={15}/> Like this movie <ArrowRight size={14}/></button>}</article>; }

function VivaGuide() {
  const [expanded, setExpanded] = useState(0);
  const algorithms = [
    {name:'Hash map / indexed lookup', complexity:'Average O(1)', icon:<Hash/>, purpose:'Maps a movie ID to its record in constant average time. Database indexes also speed up lookups by indexed columns.',demo:'Explain why an ID lookup is preferable to scanning every movie row to find one known ID.',caveat:'O(1) is an average-case hash-table claim, not a guarantee for every possible operation.'},
    {name:'Jaccard similarity', complexity:'O(a + b)', icon:<Target/>, purpose:'Compares two sets, such as a user’s preferred genres and a movie’s genres. It measures intersection size divided by union size.',demo:'A = {Drama, Sci-Fi}; B = {Sci-Fi, Action}. Intersection = 1, union = 3, so Jaccard similarity = 1/3.',caveat:'The implementation creates sets and iterates through them; complexity depends on the sizes of the input sets.'},
    {name:'Dynamic weighted graph', complexity:'Depends on relevant candidates', icon:<GitBranch/>, purpose:'Builds relationships between movies that share genres. Edge weights increase with the number of shared genres; weights contribute to candidate scores.',demo:'Choose a liked Sci-Fi movie and show how another Sci-Fi movie receives a stronger relationship signal.',caveat:'This is a relevant subgraph computed from the user’s liked movies, not a precomputed all-pairs graph. Database queries still have a cost.'},
    {name:'Binary search', complexity:'O(log N) after sorting', icon:<Search/>, purpose:'Finds an exact normalized title key in sorted records by repeatedly discarding half of the remaining search range.',demo:'For a sorted list of 16 keys, each comparison approximately halves the candidate range.',caveat:'The current search path fetches and sorts catalogue rows before searching, so end-to-end request time is not O(log N). The binary-search step itself is O(log N).'},
    {name:'Min-heap Top-K', complexity:'O(N log K)', icon:<Zap/>, purpose:'Scans candidate movies while retaining only the K best scores. When heap size exceeds K, it removes the smallest score.',demo:'For K = 5, the heap stores at most five candidates after each insertion/removal cycle.',caveat:'This assumes heap operations are O(log K). The complete scoring pass still examines N candidates.'},
    {name:'Merge sort', complexity:'O(N log N)', icon:<Layers3/>, purpose:'A stable divide-and-conquer sorting implementation is available in the backend for ranking demonstrations.',demo:'Split a list, sort both halves recursively, then merge them in order.',caveat:'The current recommendation path uses the min-heap for Top-K rather than calling merge sort for every response.'}
  ];
  return <section className="viva-page"><div className="viva-intro"><span className="step-label">PRESENTATION MODE / DSA CONCEPTS</span><h2>Know the algorithm. Defend the trade-off.</h2><p>Use this walkthrough during the demo: state the problem, show where the algorithm is used, explain its complexity, and be honest about what the complexity excludes.</p><div className="viva-stats"><div><GraduationCap/><strong>6</strong><span>DSA concepts</span></div><div><Clock3/><strong>5–7 min</strong><span>Suggested demo</span></div><div><Cpu/><strong>Full stack</strong><span>UI → API → DB</span></div></div></div>
    <div className="surface viva-script"><div className="section-heading"><div><span className="step-label">SPEAKING NOTES</span><h2>Algorithm cards</h2><p>Open each card for a concise explanation and a demo cue.</p></div></div>{algorithms.map((a,i)=><article className={`algorithm-card ${expanded===i?'expanded':''}`} key={a.name}><button className="algorithm-toggle" onClick={() => setExpanded(expanded===i ? -1 : i)}><span className="algorithm-symbol">{a.icon}</span><span className="algorithm-title"><strong>{a.name}</strong><small>{a.complexity}</small></span><ChevronRight className="algorithm-chevron" size={18}/></button>{expanded===i && <div className="algorithm-detail"><p>{a.purpose}</p><div><b>Demo cue</b><p>{a.demo}</p></div><div className="caveat"><b>Be precise</b><p>{a.caveat}</p></div></div>}</article>)}</div>
    <div className="surface viva-script"><div className="section-heading"><div><span className="step-label">LIVE DEMO PLAN</span><h2>Run it in this order</h2></div></div><ol className="demo-list"><li><span>01</span><div><strong>Introduce the problem</strong><p>Users face a large catalogue. The system ranks candidates from preferences and interactions instead of hard-coding movie lists.</p></div></li><li><span>02</span><div><strong>Show the dataset</strong><p>Point to the live catalogue count and explain that MovieLens data is stored in MySQL.</p></div></li><li><span>03</span><div><strong>Change the profile</strong><p>Select a demo user, toggle genres, change K, and generate a fresh recommendation list.</p></div></li><li><span>04</span><div><strong>Explain the ranking</strong><p>Describe genre similarity, graph signal, average rating and popularity; the min-heap keeps only the best K candidates.</p></div></li><li><span>05</span><div><strong>Demonstrate persistence</strong><p>Like a recommended movie, then explain that the interaction is posted to Express and saved in MySQL.</p></div></li><li><span>06</span><div><strong>Show search and complexity</strong><p>Search a known title, then distinguish the binary-search step from the complete fetch-and-sort request cost.</p></div></li></ol></div>
    <div className="closing-note"><CheckCircle2 size={19}/><p><strong>Strong viva answer:</strong> “We chose a min-heap because we need only K highest-scoring items. A full sort would cost O(N log N), while heap-based selection costs O(N log K) and uses O(K) heap space, excluding the catalogue data and supporting structures.”</p></div>
  </section>;
}

createRoot(document.getElementById('root')).render(<App/>);
