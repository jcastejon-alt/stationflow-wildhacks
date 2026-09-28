import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
let authRevision=0;
export function bumpAuthRevision(){authRevision++;}
export class ApiError extends Error { constructor(message:string, public status:number, public code:string) { super(message); } }
export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const requestAuthRevision=authRevision;
  let response:Response;
  let data:unknown;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { response = await fetch(`/api${path}`, { ...options, signal:options.signal||controller.signal, headers: { 'Content-Type':'application/json', ...options.headers }, cache:'no-store' });
    data = await response.json().catch(() => null);
  }
  catch { throw new ApiError('Connection lost. Check that the local demo server is running, then try again.', 0, 'OFFLINE'); }
  finally { clearTimeout(timeout); }
  if (response.status===401 && !['/auth/login','/auth/student'].includes(path) && requestAuthRevision===authRevision) window.dispatchEvent(new Event('stationflow:unauthorized'));
  if (!response.ok) throw new ApiError((data as {error?:{message?:string;code?:string}}|null)?.error?.message || `Request failed (${response.status}). Please try again.`, response.status, (data as {error?:{message?:string;code?:string}}|null)?.error?.code || 'UNKNOWN');
  if (!data) throw new ApiError('The server returned an unreadable response. Please try again.', 0, 'INVALID_RESPONSE');
  return data as T;
}
export function usePoll<T>(path:string, interval=3000) {
  const [data,setRawData] = useState<T|null>(null);
  const [statePath,setStatePath] = useState(path);
  const active = useRef(false);
  const currentPath = useRef(path);
  currentPath.current = path;
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const inFlight = useRef<number|null>(null);
  const refresh = useCallback(async () => {
    if (!active.current || currentPath.current !== path) return;
    const current = generation.current;
    if (inFlight.current===current) return;
    inFlight.current=current;
    const version = ++requestVersion.current;
    try { const result=await api<T>(path); if (active.current && currentPath.current===path && current===generation.current && version===requestVersion.current) {setRawData(result);setError('');} }
    catch (e) {if(active.current && currentPath.current===path && current===generation.current && version===requestVersion.current) setError(e instanceof Error ? e.message : 'Unable to load data.');}
    finally {if(inFlight.current===current) inFlight.current=null;if(active.current && currentPath.current===path && current===generation.current && version===requestVersion.current) setLoading(false);}
  },[path]);
  useEffect(() => {
    active.current=true; generation.current++; setStatePath(path); setRawData(null); setLoading(true); setError('');
    void refresh();
    const timer=setInterval(() => void refresh(),interval);
    // Mobile browsers can throttle the interval while the ticket is in the background.
    // Ask for the latest state as soon as the student returns to the page.
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange',refreshWhenVisible);
    window.addEventListener('focus',refreshWhenVisible);
    return()=>{active.current=false;generation.current++;clearInterval(timer);document.removeEventListener('visibilitychange',refreshWhenVisible);window.removeEventListener('focus',refreshWhenVisible);};
  },[refresh,interval,path]);
  const setData = useCallback((value: SetStateAction<T|null>) => {
    if (!active.current || currentPath.current !== path) return;
    requestVersion.current++;
    setRawData(value);
    setLoading(false);
  }, [path]);
  const matchesPath = statePath===path;
  return {data:matchesPath?data:null,error:matchesPath?error:'',loading:matchesPath?loading:true,refresh,setData};
}
export const time = (iso:string) => new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'}).format(new Date(iso));
export const windowLabel = (slot:{startsAt:string;endsAt:string}) => `${time(slot.startsAt)} – ${time(slot.endsAt)}`;
export function readStorage(key:string) {try{return localStorage.getItem(key);}catch{return null;}}
export function writeStorage(key:string,value:string) {try{localStorage.setItem(key,value);return true;}catch{return false;}}
