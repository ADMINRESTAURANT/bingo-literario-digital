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

const terms=['Cuento','Metáfora','Narrador','Novela','Verso','Protagonista','Leyenda','Estrofa','Fábula','Autor','Personaje','Poesía','Trama','Símil','Antagonista','Mito','Desenlace','Hipérbole','Moraleja','Ambiente','Drama','Personificación','Género lírico','Género narrativo'];
const clues=[
['Cuento','Relato corto con pocos personajes y una acción principal.'],
['Metáfora','Comparación implícita que relaciona dos ideas sin usar la palabra “como”.'],
['Narrador','Voz que cuenta los acontecimientos de una historia.'],
['Novela','Relato extenso, generalmente dividido en capítulos y con varios personajes.'],
['Verso','Cada una de las líneas que forman un poema.'],
['Protagonista','Personaje principal alrededor del cual se desarrolla la historia.'],
['Leyenda','Relato tradicional que mezcla elementos reales y fantásticos.'],
['Estrofa','Conjunto de versos agrupados dentro de un poema.'],
['Fábula','Relato breve que suele tener animales como personajes y deja una enseñanza.'],
['Autor','Persona que crea o escribe una obra literaria.'],
['Personaje','Ser real o imaginario que participa en los hechos de una historia.'],
['Poesía','Forma literaria que expresa emociones, ideas o sentimientos, con frecuencia mediante versos.'],
['Trama','Conjunto de acontecimientos que forman y desarrollan una historia.'],
['Símil','Comparación explícita que suele utilizar palabras como “como”, “parece” o “igual que”.'],
['Antagonista','Personaje o fuerza que se opone al protagonista.'],
['Mito','Relato tradicional relacionado con dioses, héroes o explicaciones sobre el origen de algo.'],
['Desenlace','Parte final de una narración donde se resuelve el conflicto principal.'],
['Hipérbole','Figura literaria que exagera una idea de manera intencional.'],
['Moraleja','Enseñanza o reflexión que deja una historia, especialmente una fábula.'],
['Ambiente','Lugar, época y condiciones en las que suceden los acontecimientos.'],
['Drama','Obra literaria escrita principalmente para ser representada ante un público.'],
['Personificación','Figura literaria que atribuye características humanas a animales, objetos o ideas.'],
['Género lírico','Género literario que expresa sentimientos, emociones y estados de ánimo.'],
['Género narrativo','Género literario en el que un narrador cuenta hechos reales o ficticios.']
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
function publicRoom(r){return {code:r.code,started:r.started,current:r.current,revealed:r.revealed,mode:r.mode,modeLabel:GAME_MODES[r.mode],players:[...r.players.values()].map(p=>({id:p.socketId||p.token,name:p.name,connected:!!p.socketId})),history:r.history.map(i=>({answer:clues[i][0],clue:clues[i][1],revealed:i!==r.current||r.revealed}))};}
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
 s.on('join-room',({code,name,playerToken})=>{
   code=String(code||'').trim().toUpperCase();name=String(name||'').trim();
   const r=rooms.get(code);if(!r)return s.emit('error-msg','La sala no existe o ya terminó.');if(!name)return s.emit('error-msg','Escribe tu nombre.');
   let p=playerToken?r.players.get(playerToken):null;
   if(p){p.socketId=s.id;p.name=name||p.name;}
   else{playerToken=token();p={token:playerToken,socketId:s.id,name,board:board(),marks:new Set([12])};r.players.set(playerToken,p);}
   s.join(code);s.data={room:code,role:'player',token:playerToken};
   s.emit('joined',{room:publicRoom(r),board:p.board,marks:[...p.marks],playerToken});
   if(r.moderator)io.to(r.moderator).emit('room-state',publicRoom(r));
 });
 s.on('start',({mode}={})=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;if(!GAME_MODES[mode])mode='FILA';r.mode=mode;r.started=true;io.to(r.code).emit('started',publicRoom(r));});
 s.on('draw',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;if(!r.started)return s.emit('error-msg','Primero inicia la partida.');if(r.current!==null&&!r.revealed)return s.emit('error-msg','Revela la respuesta anterior.');if(!r.remaining.length)return s.emit('error-msg','Ya salieron todas las pistas.');r.current=r.remaining.pop();r.revealed=false;r.history.push(r.current);io.to(r.code).emit('clue',{text:clues[r.current][1],number:r.history.length,remaining:r.remaining.length});});
 s.on('reveal',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id||r.current===null)return;r.revealed=true;io.to(r.code).emit('answer',{answer:clues[r.current][0],room:publicRoom(r)});});
 s.on('mark',i=>{const r=rooms.get(s.data.room);const p=r?.players.get(s.id);i=Number(i);if(!r||!p||i===12||i<0||i>24)return;if(!r.started)return s.emit('mark-error','La partida todavía no ha iniciado.');if(p.marks.has(i))return s.emit('mark-error','Esa casilla ya quedó tapada y no se puede destapar.');const revealed=revealedAnswers(r);if(!revealed.has(p.board[i]))return s.emit('mark-error','Esa palabra todavía no ha sido mostrada por el moderador.');p.marks.add(i);s.emit('marks',[...p.marks]);});
 s.on('bingo',()=>{const r=rooms.get(s.data.room);const p=r?.players.get(s.id);if(!p)return;const ok=bingoOk(p,r);s.emit('bingo-result',{ok,modeLabel:GAME_MODES[r.mode]});io.to(r.moderator).emit('claim',{name:p.name,ok,modeLabel:GAME_MODES[r.mode]});if(ok)io.to(r.code).emit('winner',{name:p.name,modeLabel:GAME_MODES[r.mode]});});
 s.on('reset',()=>{const r=rooms.get(s.data.room);if(!r||r.moderator!==s.id)return;r.started=false;r.remaining=shuffle(clues.map((_,i)=>i));r.history=[];r.current=null;r.revealed=false;r.mode='FILA';for(const p of r.players.values()){p.board=board();p.marks=new Set([12]);io.to(p.id).emit('new-board',p.board);}io.to(r.code).emit('reset',publicRoom(r));});
 s.on('disconnect',()=>{const r=rooms.get(s.data.room);if(!r)return;if(r.moderator===s.id){io.to(r.code).emit('closed');rooms.delete(r.code);}else if(r.players.delete(s.id))io.to(r.moderator).emit('room-state',publicRoom(r));});
});

server.listen(PORT,'0.0.0.0',()=>console.log('Bingo Literario en puerto '+PORT));