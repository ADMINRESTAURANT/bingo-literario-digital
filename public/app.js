const socket=io(),$=id=>document.getElementById(id);let role=null,roomCode='',board=[],marks=new Set([12]),installPrompt=null;
function show(id){['home','moderator','player'].forEach(x=>$(x).classList.add('hide'));$(id).classList.remove('hide')}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderBoard(){$('board').innerHTML='';board.forEach((t,i)=>{const b=document.createElement('button');b.className='cell'+(marks.has(i)?' marked':'')+(i===12?' free':'');b.textContent=t;b.onclick=()=>i!==12&&socket.emit('mark',i);$('board').appendChild(b)})}
function renderPlayers(ps){$('count').textContent=ps.length;$('players').innerHTML=ps.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join('')}
function renderHistory(h){$('history').innerHTML=h.length?h.map((x,i)=>'<div><b>'+(i+1)+'.</b> '+esc(x.clue)+' <span class="history-answer">— '+esc(x.answer)+'</span></div>').join(''):'<p>Aún no hay pistas.</p>'}
async function qr(code){const url=location.origin+'/?room='+code;$('url').textContent=url;const r=await fetch('/api/qr?url='+encodeURIComponent(url)).then(r=>r.json());$('qr').src=r.data}
$('create').onclick=()=>socket.emit('create-room',{name:$('modName').value});
$('join').onclick=()=>socket.emit('join-room',{code:$('code').value,name:$('name').value});
$('start').onclick=()=>socket.emit('start');$('draw').onclick=()=>socket.emit('draw');$('reveal').onclick=()=>socket.emit('reveal');$('reset').onclick=()=>socket.emit('reset');$('claim').onclick=()=>socket.emit('bingo');
socket.on('room-created',r=>{role='moderator';roomCode=r.code;show('moderator');$('mCode').textContent=r.code;renderPlayers(r.players);renderHistory(r.history);qr(r.code)});
socket.on('joined',d=>{role='player';roomCode=d.room.code;board=d.board;marks=new Set([12]);show('player');$('pCode').textContent=roomCode;renderBoard()});
socket.on('room-state',r=>{if(role==='moderator')renderPlayers(r.players)});
socket.on('started',()=>{if(role==='moderator')$('mStatus').textContent='Partida en curso';else $('pStatus').textContent='Partida en curso'});
socket.on('clue',d=>{if(role==='moderator'){$('num').textContent='Pista '+d.number;$('left').textContent=d.remaining+' restantes';$('clue').textContent=d.text;$('ans').classList.add('hide')}else{$('pNum').textContent='Pista '+d.number;$('pClue').textContent=d.text;$('pAns').classList.add('hide')}});
socket.on('answer',d=>{if(role==='moderator'){$('ans').textContent='Respuesta: '+d.answer;$('ans').classList.remove('hide');renderHistory(d.room.history)}else{$('pAns').textContent='Respuesta: '+d.answer;$('pAns').classList.remove('hide')}});
socket.on('marks',m=>{marks=new Set(m);renderBoard()});
socket.on('bingo-result',ok=>{$('msg').textContent=ok?'✅ ¡Bingo correcto!':'❌ Aún no tienes un bingo válido.';$('msg').style.color=ok?'#2f7d5a':'#b43f4f'});
socket.on('claim',d=>{if(role==='moderator')$('mStatus').textContent=d.ok?'✅ Bingo válido de '+d.name:'❌ '+d.name+' aún no tiene bingo válido'});
socket.on('winner',name=>{$('winnerName').textContent=name;$('winner').classList.remove('hide')});
socket.on('new-board',b=>{board=b;marks=new Set([12]);if(role==='player')renderBoard()});
socket.on('reset',r=>{if(role==='moderator'){$('mStatus').textContent='Esperando inicio';$('clue').textContent='Nueva ronda lista.';$('num').textContent='Pista 0';$('left').textContent='24 restantes';$('ans').classList.add('hide');renderHistory([])}else{$('pStatus').textContent='Esperando';$('pClue').textContent='Nueva ronda preparada. Espera al moderador.';$('pAns').classList.add('hide');$('msg').textContent=''}});
socket.on('error-msg',m=>{if(role==='player'||!role)$('err').textContent=m;else alert(m)});
socket.on('closed',()=>{alert('El moderador cerró la sala.');location.reload()});
const pre=new URLSearchParams(location.search).get('room');if(pre)$('code').value=pre.toUpperCase();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').classList.remove('hide')});$('install').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install').classList.add('hide')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));