const express=require('express');
const http=require('http');
const QRCode=require('qrcode');
const crypto=require('crypto');
const {Server}=require('socket.io');

const app=express();
const server=http.createServer(app);
const io=new Server(server);
const PORT=process.env.PORT||3000;

app.use(express.static('public'));

const terms=[
'Administración financiera','Liquidez','Rentabilidad','Riesgo financiero','Flujo de caja',
'Capital de trabajo','Presupuesto','Endeudamiento','Apalancamiento','Tasa de interés',
'Gestión del riesgo','Decisiones de inversión','Hipotecas subprime','Burbuja inmobiliaria','Titulización',
'Lehman Brothers','Crisis de liquidez','Crisis crediticia','Rescate financiero','Recesión mundial',
'Desempleo','Caída bursátil','Regulación financiera','Lecciones de 2008'
];
const clues=[
['Administración financiera','Disciplina que busca planear, obtener, invertir y controlar los recursos financieros para mantener la estabilidad y el valor de una organización.'],
['Liquidez','Capacidad de disponer de efectivo suficiente para cumplir obligaciones de corto plazo; su falta fue un problema central durante la crisis de 2008.'],
['Rentabilidad','Resultado económico obtenido en relación con los recursos invertidos; una mayor rentabilidad suele implicar asumir ciertos niveles de riesgo.'],
['Riesgo financiero','Posibilidad de sufrir pérdidas por decisiones de crédito, inversión, deuda, tasas de interés o movimientos del mercado.'],
['Flujo de caja','Entradas y salidas reales de dinero que permiten saber si una organización puede cumplir sus pagos y continuar operando.'],
['Capital de trabajo','Recursos de corto plazo necesarios para financiar las operaciones diarias y sostener la actividad de una empresa.'],
['Presupuesto','Herramienta de planeación financiera que organiza ingresos, gastos e inversiones esperadas para controlar los recursos.'],
['Endeudamiento','Uso de recursos prestados que deben devolverse; cuando es excesivo puede aumentar la vulnerabilidad financiera.'],
['Apalancamiento','Uso de deuda para financiar inversiones con la intención de aumentar el rendimiento, pero también incrementando el riesgo de pérdidas.'],
['Tasa de interés','Costo del dinero prestado; sus cambios afectan el crédito, las hipotecas, la inversión y las decisiones financieras.'],
['Gestión del riesgo','Proceso de identificar, analizar y controlar riesgos financieros para reducir la posibilidad de pérdidas importantes.'],
['Decisiones de inversión','Elección de dónde colocar recursos buscando rentabilidad, considerando riesgo, liquidez y horizonte de tiempo.'],
['Hipotecas subprime','Créditos hipotecarios otorgados a personas con mayor probabilidad de incumplimiento; fueron uno de los detonantes de la crisis de 2008.'],
['Burbuja inmobiliaria','Incremento excesivo y poco sostenible del precio de las viviendas, alimentado por crédito fácil y expectativas de nuevas subidas.'],
['Titulización','Proceso de agrupar créditos, como hipotecas, y convertirlos en valores financieros que pueden venderse a inversionistas.'],
['Lehman Brothers','Banco de inversión estadounidense cuya quiebra en septiembre de 2008 profundizó la pérdida de confianza y la crisis financiera mundial.'],
['Crisis de liquidez','Situación en la que bancos y empresas tienen dificultades para obtener efectivo o financiamiento inmediato, incluso teniendo activos.'],
['Crisis crediticia','Reducción fuerte de la disponibilidad de préstamos porque las entidades financieras aumentan sus restricciones y desconfían del riesgo.'],
['Rescate financiero','Medidas extraordinarias de gobiernos y bancos centrales para apoyar instituciones, estabilizar mercados y evitar un colapso mayor.'],
['Recesión mundial','Caída generalizada de la actividad económica que afectó producción, consumo, inversión y comercio tras la crisis financiera de 2008.'],
['Desempleo','Pérdida de puestos de trabajo provocada por la reducción de la actividad económica, uno de los efectos sociales más graves de la crisis.'],
['Caída bursátil','Descenso fuerte del precio de las acciones debido al miedo, las pérdidas financieras y la pérdida de confianza de los inversionistas.'],
['Regulación financiera','Normas y controles aplicados al sistema financiero para limitar riesgos excesivos, mejorar la supervisión y proteger la estabilidad.'],
['Lecciones de 2008','La crisis mostró la importancia de controlar el endeudamiento, evaluar riesgos, mantener liquidez, diversificar y fortalecer la supervisión financiera.']
];

const GAME_MODES={
 FILA:'Una fila',
 COLUMNA:'Una columna',
 DIAGONAL:'Una diagonal',
 X:'X (dos diagonales)',
 ESQUINAS:'Cuatro esquinas',
 TABLA_LLENA:'Tabla llena'
};

const rooms=new Map();
const shuffle=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const code=()=>Math.random().toString(36).slice(2,7).toUpperCase();
const token=()=>crypto.randomUUID();
const board=()=>{const a=shuffle(terms);const b=[];let k=0;for(let i=0;i<25;i++)b.push(i===12?'LIBRE':a[k++]);return b;};

app.get('/api/qr',async(req,res)=>{try{res.json({data:await QRCode.toDataURL(req.query.url||'',{width:320,margin:1})});}catch(e){res.status(400).json({error:'QR'});}});

function revealedAnswers(r){return new Set(r.history.filter(i=>i!==r.current||r.revealed).map(i=>clues[i][0]));}
function leaderboard(r){
 return [...r.players.values()]
   .map(p=>({name:p.name,score:p.score||0,connected:!!p.socketId}))
   .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
}
function emitLeaderboard(r){io.to(r.code).emit('leaderboard',leaderboard(r));}
function publicRoom(r){return {code:r.code,started:r.started,current:r.current,revealed:r.revealed,mode:r.mode,modeLabel:GAME_MODES[r.mode],currentClue:r.current===null?null:{clue:clues[r.current][1],answer:r.revealed?clues[r.current][0]:null,number:r.history.length,remaining:r.remaining.length},players:[...r.players.values()].map(p=>({id:p.socketId||p.token,name:p.name,connected:!!p.socketId,score:p.score||0})),history:r.history.map(i=>({answer:clues[i][0],clue:clues[i][1],revealed:i!==r.current||r.revealed}))};}
function bingoOk(p,r){
 const revealed=revealedAnswers(r);
 const good=i=>i===12||(p.marks.has(i)&&revealed.has(p.board[i]));
 const rows=[0,1,2,3,4].map(rr=>[0,1,2,3,4].map(col=>rr*5+col));
 const cols=[0,1,2,3,4].map(col=>[0,1,2,3,4].map(rr=>rr*5+col));
 const diags=[[0,6,12,18,24],[4,8,12,16,20]];
 if(r.mode==='FILA')return rows.some(line=>line.every(good));
 if(r.mode==='COLUMNA')return cols.some(line=>line.every(good));
 if(r.mode==='DIAGONAL')return diags.some(line=>line.every(good));
 if(r.mode==='X')return diags.every(line=>line.every(good));
 if(r.mode==='ESQUINAS')return [0,4,20,24].every(good);
 if(r.mode==='TABLA_LLENA')return Array.from({length:25},(_,i)=>i).every(good);
 return false;
}

io.on('connection',s=>{
 s.on('create-room',({name,password})=>{
   const moderatorPassword=process.env.MODERATOR_PASSWORD;
   if(!moderatorPassword)return s.emit('moderator-auth-error','La contraseña del moderador todavía no está configurada en el servidor.');
   if(String(password||'')!==moderatorPassword)return s.emit('moderator-auth-error','Contraseña de moderador incorrecta.');
   let c=code();while(rooms.has(c))c=code();
   const moderatorToken=token();
   const r={code:c,moderator:s.id,moderatorToken,moderatorTimer:null,players:new Map(),started:false,remaining:shuffle(clues.map((_,i)=>i)),history:[],current:null,revealed:false,mode:'FILA'};
   rooms.set(c,r);s.join(c);s.data={room:c,role:'moderator',token:moderatorToken};
   s.emit('room-created',{room:publicRoom(r),moderatorToken});
 });
 s.on('resume-moderator',({code,moderatorToken})=>{
   code=String(code||'').trim().toUpperCase();
   const r=rooms.get(code);
   if(!r||!moderatorToken||r.moderatorToken!==moderatorToken)return s.emit('resume-moderator-failed');
   if(r.moderatorTimer){clearTimeout(r.moderatorTimer);r.moderatorTimer=null;}
   r.moderator=s.id;s.join(code);s.data={room:code,role:'moderator',token:moderatorToken};
   s.emit('moderator-resumed',{room:publicRoom(r),moderatorToken});
   io.to(code).emit('moderator-back');
 });
 s.on('join-room',({code,name,playerToken})=>{
   code=String(code||'').trim().toUpperCase();name=String(name||'').trim();
   const r=rooms.get(code);if(!r)return s.emit('error-msg','La sala no existe o ya terminó.');if(!name)return s.emit('error-msg','Escribe tu nombre.');
   let p=playerToken?r.players.get(playerToken):null;
   if(p){p.socketId=s.id;p.name=name||p.name;if(typeof p.score!=='number')p.score=0;if(p.guessedClue===undefined)p.guessedClue=null;}
   else{playerToken=token();p={token:playerToken,socketId:s.id,name,board:board(),marks:new Set([12]),score:0,guessedClue:null};r.players.set(playerToken,p);}
   s.join(code);s.data={room:code,role:'player',token:playerToken};
   s.emit('joined',{room:publicRoom(r),board:p.board,marks:[...p.marks],playerToken,score:p.score||0,guessedCurrent:p.guessedClue===r.current});
   if(r.moderator)io.to(r.moderator).emit('room-state',publicRoom(r));emitLeaderboard(r);
 });
 s.on('start',({mode}={})=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;if(!GAME_MODES[mode])mode='FILA';r.mode=mode;r.started=true;io.to(r.code).emit('started',publicRoom(r));});
 s.on('draw',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;if(!r.started)return s.emit('error-msg','Primero inicia la partida.');if(r.current!==null&&!r.revealed)return s.emit('error-msg','Revela la respuesta anterior.');if(!r.remaining.length)return s.emit('error-msg','Ya salieron todas las pistas.');r.current=r.remaining.pop();r.revealed=false;r.history.push(r.current);io.to(r.code).emit('clue',{text:clues[r.current][1],number:r.history.length,remaining:r.remaining.length});});
 s.on('reveal',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id||r.current===null)return;r.revealed=true;io.to(r.code).emit('answer',{answer:clues[r.current][0],room:publicRoom(r)});});
 s.on('guess',i=>{
   const r=rooms.get(s.data.room);const p=r?.players.get(s.data.token);i=Number(i);
   if(!r||!p||!r.started||r.current===null||r.revealed)return s.emit('guess-error','Ahora no hay una pista disponible para responder.');
   if(i<0||i>24||i===12)return;
   if(p.guessedClue===r.current)return s.emit('guess-error','Ya hiciste tu intento para esta pista.');
   p.guessedClue=r.current;
   const correct=p.board[i]===clues[r.current][0];
   if(correct)p.score=(p.score||0)+1;
   s.emit('guess-result',{correct,index:i,score:p.score||0});
   if(r.moderator)io.to(r.moderator).emit('room-state',publicRoom(r));emitLeaderboard(r);
 });
 s.on('mark',i=>{const r=rooms.get(s.data.room);const p=r?.players.get(s.data.token);i=Number(i);if(!r||!p||i===12||i<0||i>24)return;if(!r.started)return s.emit('mark-error','La partida todavía no ha iniciado.');if(p.marks.has(i))return s.emit('mark-error','Esa casilla ya quedó tapada y no se puede destapar.');const revealed=revealedAnswers(r);if(!revealed.has(p.board[i]))return s.emit('mark-error','Esa palabra todavía no ha sido mostrada por el moderador.');p.marks.add(i);s.emit('marks',[...p.marks]);});
 s.on('bingo',()=>{const r=rooms.get(s.data.room);const p=r?.players.get(s.data.token);if(!p)return;const ok=bingoOk(p,r);s.emit('bingo-result',{ok,modeLabel:GAME_MODES[r.mode]});io.to(r.moderator).emit('claim',{name:p.name,ok,modeLabel:GAME_MODES[r.mode]});if(ok)io.to(r.code).emit('winner',{name:p.name,modeLabel:GAME_MODES[r.mode]});});
 s.on('reset',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;r.started=false;r.remaining=shuffle(clues.map((_,i)=>i));r.history=[];r.current=null;r.revealed=false;r.mode='FILA';for(const p of r.players.values()){p.board=board();p.marks=new Set([12]);p.score=0;p.guessedClue=null;if(p.socketId)io.to(p.socketId).emit('new-board',{board:p.board,score:0});}io.to(r.code).emit('reset',publicRoom(r));emitLeaderboard(r);});
 s.on('disconnect',()=>{
   const r=rooms.get(s.data.room);if(!r)return;
   if(s.data.role==='moderator'&&r.moderator===s.id){
     r.moderator=null;
     io.to(r.code).emit('moderator-away');
     r.moderatorTimer=setTimeout(()=>{
       const current=rooms.get(r.code);
       if(current&&!current.moderator){io.to(r.code).emit('closed');rooms.delete(r.code);}
     },5*60*1000);
     return;
   }
   if(s.data.role==='player'){
     const p=r.players.get(s.data.token);
     if(p){p.socketId=null;if(r.moderator)io.to(r.moderator).emit('room-state',publicRoom(r));emitLeaderboard(r);}
   }
 });
});

server.listen(PORT,'0.0.0.0',()=>console.log('Bingo Literario en puerto '+PORT));