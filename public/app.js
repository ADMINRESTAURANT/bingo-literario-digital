const socket=io(),$=id=>document.getElementById(id);let role=null,roomCode='',board=[],marks=new Set([12]),revealedAnswers=new Set(),installPrompt=null;let playerToken=localStorage.getItem('bingoPlayerToken')||'';let moderatorToken=localStorage.getItem('bingoModeratorToken')||'';
function show(id){['home','moderator','player'].forEach(x=>$(x).classList.add('hide'));$(id).classList.remove('hide')}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderBoard(){$('board').innerHTML='';board.forEach((t,i)=>{const b=document.createElement('button');const available=i===12||revealedAnswers.has(t);b.className='cell'+(marks.has(i)?' marked':'')+(i===12?' free':'')+(available?' available':' locked');b.textContent=t;b.onclick=()=>i!==12&&socket.emit('mark',i);$('board').appendChild(b)})}
function renderPlayers(ps){$('count').textContent=ps.length;$('players').innerHTML=ps.map(p=>'<span class="chip">'+esc(p.name)+'</span>').join('')}
function renderHistory(h){$('history').innerHTML=h.length?h.map((x,i)=>'<div><b>'+(i+1)+'.</b> '+esc(x.clue)+' <span class="history-answer">— '+esc(x.answer)+'</span></div>').join(''):'<p>Aún no hay pistas.</p>'}
async function qr(code){const url=location.origin+'/?room='+code;$('url').textContent=url;const r=await fetch('/api/qr?url='+encodeURIComponent(url)).then(r=>r.json());$('qr').src=r.data}
$('create').onclick=()=>{ $('modErr').textContent=''; socket.emit('create-room',{name:$('modName').value,password:$('modPassword').value}); };
$('join').onclick=()=>socket.emit('join-room',{code:$('code').value,name:$('name').value,playerToken:playerToken});
$('start').onclick=()=>socket.emit('start',{mode:$('gameMode').value});$('draw').onclick=()=>socket.emit('draw');$('reveal').onclick=()=>socket.emit('reveal');$('reset').onclick=()=>socket.emit('reset');$('claim').onclick=()=>socket.emit('bingo');
socket.on('room-created',d=>{const r=d.room;role='moderator';roomCode=r.code;moderatorToken=d.moderatorToken;localStorage.setItem('bingoModeratorToken',moderatorToken);localStorage.setItem('bingoModeratorRoom',roomCode);show('moderator');$('mCode').textContent=r.code;$('mMode').textContent=r.modeLabel;renderPlayers(r.players);renderHistory(r.history);qr(r.code)});
socket.on('moderator-auth-error',m=>{$('modErr').textContent=m;});
socket.on('joined',d=>{
 const r=d.room;role='player';roomCode=r.code;board=d.board;marks=new Set(d.marks||[12]);playerToken=d.playerToken;
 localStorage.setItem('bingoPlayerToken',playerToken);localStorage.setItem('bingoPlayerRoom',roomCode);localStorage.setItem('bingoPlayerName',$('name').value);
 revealedAnswers=new Set((r.history||[]).filter(x=>x.revealed).map(x=>x.answer));
 show('player');$('pCode').textContent=roomCode;$('pMode').textContent=r.modeLabel;
 $('pStatus').textContent=r.started?'Partida en curso':'Esperando';
 if(r.currentClue){$('pNum').textContent='Pista '+r.currentClue.number;$('pClue').textContent=r.currentClue.clue;if(r.currentClue.answer){$('pAns').textContent='Respuesta: '+r.currentClue.answer;$('pAns').classList.remove('hide')}}
 renderBoard();
});
socket.on('moderator-resumed',d=>{
 const r=d.room;role='moderator';roomCode=r.code;moderatorToken=d.moderatorToken;
 show('moderator');$('mCode').textContent=r.code;$('mMode').textContent=r.modeLabel;renderPlayers(r.players);renderHistory(r.history);qr(r.code);
 $('mStatus').textContent=r.started?'Partida en curso':'Esperando jugadores';
 $('gameMode').value=r.mode;$('gameMode').disabled=!!r.started;$('start').disabled=!!r.started;
 if(r.currentClue){$('num').textContent='Pista '+r.currentClue.number;$('left').textContent=r.currentClue.remaining+' restantes';$('clue').textContent=r.currentClue.clue;if(r.currentClue.answer){$('ans').textContent='Respuesta: '+r.currentClue.answer;$('ans').classList.remove('hide')}}
});
socket.on('resume-moderator-failed',()=>{localStorage.removeItem('bingoModeratorToken');localStorage.removeItem('bingoModeratorRoom')});
socket.on('room-state',r=>{if(role==='moderator')renderPlayers(r.players)});
socket.on('started',r=>{if(role==='moderator'){$('mStatus').textContent='Partida en curso';$('mMode').textContent=r.modeLabel;$('gameMode').disabled=true;$('start').disabled=true}else{$('pStatus').textContent='Partida en curso';$('pMode').textContent=r.modeLabel}renderBoard()});
socket.on('clue',d=>{if(role==='moderator'){$('num').textContent='Pista '+d.number;$('left').textContent=d.remaining+' restantes';$('clue').textContent=d.text;$('ans').classList.add('hide')}else{$('pNum').textContent='Pista '+d.number;$('pClue').textContent=d.text;$('pAns').classList.add('hide')}});
socket.on('answer',d=>{revealedAnswers.add(d.answer);if(role==='moderator'){$('ans').textContent='Respuesta: '+d.answer;$('ans').classList.remove('hide');renderHistory(d.room.history)}else{$('pAns').textContent='Respuesta: '+d.answer;$('pAns').classList.remove('hide');renderBoard()}});
socket.on('marks',m=>{marks=new Set(m);renderBoard()});
socket.on('bingo-result',d=>{$('msg').textContent=d.ok?'✅ ¡Bingo correcto!':'❌ Aún no tienes el bingo válido para: '+d.modeLabel;$('msg').style.color=d.ok?'#2f7d5a':'#b43f4f'});
socket.on('claim',d=>{if(role==='moderator')$('mStatus').textContent=d.ok?'✅ Bingo válido de '+d.name+' ('+d.modeLabel+')':'❌ '+d.name+' aún no tiene bingo válido'});
socket.on('winner',d=>{$('winnerName').textContent=d.name;$('winnerMode').textContent='Modalidad: '+d.modeLabel;$('winner').classList.remove('hide');launchCelebration()});
socket.on('new-board',b=>{board=b;marks=new Set([12]);revealedAnswers=new Set();if(role==='player')renderBoard()});
socket.on('reset',r=>{revealedAnswers=new Set();if(role==='moderator'){$('mStatus').textContent='Esperando inicio';$('clue').textContent='Nueva ronda lista.';$('num').textContent='Pista 0';$('left').textContent='24 restantes';$('ans').classList.add('hide');$('gameMode').disabled=false;$('start').disabled=false;$('gameMode').value='FILA';$('mMode').textContent='Una fila';renderHistory([])}else{$('pStatus').textContent='Esperando';$('pClue').textContent='Nueva ronda preparada. Espera al moderador.';$('pAns').classList.add('hide');$('msg').textContent='';$('pMode').textContent='Una fila';renderBoard()}});
socket.on('error-msg',m=>{if(role==='player'||!role)$('err').textContent=m;else alert(m)});
socket.on('closed',()=>{alert('El moderador cerró la sala.');location.reload()});
function launchCelebration(){
 const wrap=document.createElement('div');wrap.className='celebration';document.body.appendChild(wrap);
 const emojis=['🎉','✨','💚','🏆','🎊'];
 for(let i=0;i<90;i++){const p=document.createElement('span');p.textContent=emojis[Math.floor(Math.random()*emojis.length)];p.style.left=Math.random()*100+'vw';p.style.animationDelay=(Math.random()*.5)+'s';p.style.animationDuration=(1.8+Math.random()*1.8)+'s';wrap.appendChild(p)}
 setTimeout(()=>wrap.remove(),4200);
}
function restoreSession(){
 const mRoom=localStorage.getItem('bingoModeratorRoom');
 if(moderatorToken&&mRoom&&!role){socket.emit('resume-moderator',{code:mRoom,moderatorToken});return}
 const pRoom=localStorage.getItem('bingoPlayerRoom'),pName=localStorage.getItem('bingoPlayerName');
 if(playerToken&&pRoom&&pName&&!role){$('name').value=pName;$('code').value=pRoom;socket.emit('join-room',{code:pRoom,name:pName,playerToken});}
}
socket.on('connect',restoreSession);
if(socket.connected)restoreSession();
socket.on('moderator-away',()=>{if(role==='player')$('pStatus').textContent='Moderador reconectando…'});
socket.on('moderator-back',()=>{if(role==='player')$('pStatus').textContent='Partida en curso'});
const pre=new URLSearchParams(location.search).get('room');if(pre)$('code').value=pre.toUpperCase();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').classList.remove('hide')});$('install').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install').classList.add('hide')}};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
socket.on('mark-error',m=>{$('msg').textContent='⚠️ '+m;$('msg').style.color='#b43f4f'});