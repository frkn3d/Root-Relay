/* ============================================================
   MOTOR / SİMÜLASYON ADIMLARI — update()'in her karede sırayla
   çağırdığı adımlar. Her fonksiyon tek bir işten sorumlu; sıralama
   ve birbirine bağlılık engine.js'teki update() bestecisinde görülür.

   Adımlar oyun durumunu doğrudan değiştirir (engine-state.js'teki
   paylaşılan diziler). İki adım bölümü bitirebilir ve bunu dönüş
   değeriyle bildirir: false → update() o kare erken durur.
   ============================================================ */

/* Dalga zaman çizelgesini ilerletir, sırası gelen düşmanları doğurur
   ve dalga temizlendiyse sonrakine hazırlanır.
   false → son dalga da bitti, bölüm kazanıldı. */
function updateWaveProgress(dt){
  if(waveActive){
    waveElapsed += dt;
    let pending=false;
    spawnTimeline.forEach(entry=>{
      if(!entry.spawned){
        if(entry.t<=waveElapsed){
          entry.spawned=true;
          enemies.push({
            ...entry, dist:0, flashT:0,
            bounce:Math.random()*10, slowT:0, slowFactor:1,
            // Her birim kendi salınım fazı/frekansı/genliğiyle doğar;
            // aksi halde aynı anda doğanlar senkronize hareket eder.
            wobbleT: Math.random()*Math.PI*2,
            wobbleSeed: Math.random()*2.2,
            wobbleScale: 0.65 + Math.random()*0.7,
            wobblePhase2: Math.random()*Math.PI*2,
            spin: Math.random()*Math.PI*2,
            spinDir: Math.random()<0.5 ? -1 : 1,
            // Birden fazla giriş varsa düşmanlar rotalara dağıtılır
            pathIdx: entry.pathIdx || 0,
          });
        }
        else pending=true;
      }
    });
    if(!pending && enemies.length===0){
      waveActive=false;
      if(waveIndex>=level.waveCount){ endGame(true); return false; }
      playWaveComplete();   // audio.js — dalga başarıyla bitince kısa bir başarı ezgisi
      if(typeof updateAmbience === 'function') updateAmbience();   // sfx.js — savaş katmanı sussun
      showWaveToast(`Dalga ${waveIndex} Tamamlandı!`); // ui.js
      setWaveBtnReady(true); // ui.js
      renderWavePreview();   // ui.js
    }
  }
  return true;
}

function applyQueenAuras(){
  /* SÜRÜ ANASI AURASI: yarıçapındaki müttefik türlere (Spor/Sürü gibi)
     hız ve hasar direnci verir — Don Efendisi'nin tam tersi, kuleleri
     değil düşmanları güçlendirir. Onu öncelikli öldürmek dalgayı
     belirgin şekilde kolaylaştırır çünkü buff'lı birimler onunla
     birlikte yeteneklerini kaybeder. */
  enemies.forEach(e=>{ e.queenSpeedBuff = 0; e.queenDmgResist = 0; });
  let buffed = false;
  enemies.forEach(q=>{
    if(!q.allyBuffTypes || !q.allyBuffTypes.length) return;
    enemies.forEach(e=>{
      if(e===q || !q.allyBuffTypes.includes(e.type)) return;
      if(Math.hypot(e.x-q.x, e.y-q.y) <= q.auraRadius){
        if(q.allySpeedBuff > e.queenSpeedBuff) e.queenSpeedBuff = q.allySpeedBuff;
        if(q.allyDmgResist > e.queenDmgResist) e.queenDmgResist = q.allyDmgResist;
        buffed = true;
      }
    });
  });
  // Ses, döngünün İÇİNDEN değil sonundan bir kez çağrılır: yüzlerce
  // birim varken throttleSound'u kare başına yüzlerce kez yoklamayalım.
  if(buffed) playQueenBuff();   // audio.js
}

/* Düşmanları yol boyunca ilerletir, salınım/yanma/yavaşlama sayaçlarını
   işler ve Kuluçka'nın bu karede bıraktığı yavruları geri döndürür
   (çağıran, onları doğru sırada diziye ekler). */
function updateEnemyMovement(dt){
  const newborns = [];   // Kuluçka'nın bu karede bıraktığı yavrular
  let burning = false;   // sahada yanan biri var mı (kavrulma cızırtısı için)
  enemies.forEach(e=>{
    const slowMult = e.slowT>0 ? e.slowFactor : 1;
    const queenMult = 1 + (e.queenSpeedBuff||0);
    e.dist += e.speed*slowMult*queenMult*dt*60;
    const myPath = levelPaths[e.pathIdx || 0] || levelPaths[0];
    const myLen  = pathLens[e.pathIdx || 0] || pathTotalLen;
    const p = pointAtDistance(myPath, myLen, e.dist);
    const p2 = pointAtDistance(myPath, myLen, e.dist+2);
    e.x=p.x; e.y=p.y;
    e.angle = Math.atan2(p2.y-p.y, p2.x-p.x);

    // "Deli gibi" hareket: yolun eksenine dik, düzensiz salınım.
    // İki farklı frekansın toplamı düzenli bir sinüsten çok daha
    // öngörülemez görünür.
    if(e.wobbleAmp){
      e.wobbleT = (e.wobbleT||0) + dt*(3.2 + (e.wobbleSeed||0));
      // Üç farklı frekansın toplamı + birime özel faz kayması:
      // aynı anda doğan birimler bile birbirinden bağımsız savrulur.
      const ph = e.wobblePhase2 || 0;
      const off = Math.sin(e.wobbleT)*0.55
                + Math.sin(e.wobbleT*2.7 + 1.3 + ph)*0.3
                + Math.sin(e.wobbleT*0.61 + ph*2)*0.25;
      const len = Math.hypot(p2.x-p.x, p2.y-p.y) || 1;
      const nx = -(p2.y-p.y)/len, ny = (p2.x-p.x)/len;   // dik vektör
      const amp = e.wobbleAmp * (e.wobbleScale || 1);
      e.x += nx*off*amp;
      e.y += ny*off*amp;
      e.spin = (e.spin||0) + dt*(2.5 + off*2) * (e.spinDir || 1);
    }

    e.bounce += dt*e.speed*slowMult*9;
    if(e.flashT>0) e.flashT -= dt*3;
    if(e.blockFlash>0) e.blockFlash -= dt*3;
    if(e.slowT>0) e.slowT -= dt;

    /* KULUÇKA: yaşadığı sürece belirli aralıklarla yavru bırakır.
       Öldürülünce üretim durur — "hemen indir" baskısı yaratır. */
    if(e.broodEvery > 0 && e.broodCount < e.broodMax){
      e.broodT += dt;
      if(e.broodT >= e.broodEvery){
        e.broodT = 0;
        e.broodCount++;
        const def = ENEMY_TYPES[e.broodType] || ENEMY_TYPES.swarm;
        const mult = statMultipliers(level, waveIndex);
        const m = levelMods();
        newborns.push({
          type:e.broodType,
          hp: def.hp*mult.hp, maxHp: def.hp*mult.hp,
          speed: def.speed*mult.speed*m.enemySpeedMul,
          radius: def.radius, body:def.body, body2:def.body2, shape:def.shape, eyes:def.eyes,
          gold: Math.max(1, Math.round(def.gold*m.goldMul)), dmgToLives: def.dmgToLives,
          pathIdx: e.pathIdx || 0,
          dist: Math.max(0, e.dist - 12),
          flashT:0, slowT:0, slowFactor:1, bounce:Math.random()*10,
          wobbleT:Math.random()*Math.PI*2, wobbleSeed:Math.random()*2.2,
          wobbleScale:0.65+Math.random()*0.7, wobblePhase2:Math.random()*Math.PI*2,
          spin:Math.random()*Math.PI*2, spinDir:Math.random()<0.5?-1:1,
          splitsLeft:0, broodEvery:0, blockArc:0, overloadSec:0,
          healRadius:0, auraRadius:0,
        });
        playBrooderSpawn();   // audio.js
        for(let i=0;i<8;i++){
          const a=(i/8)*Math.PI*2;
          particles.push({x:e.x,y:e.y,vx:Math.cos(a)*60,vy:Math.sin(a)*60,life:0.3,color:e.body});
        }
      }
    }
    /* ZEHİR + ATEŞ: TEK ortak "yanma" (dot) yuvası paylaşırlar — Zehir
       Sarmaşığı ve Ateş Kulesi aynı hedefte üst üste binip hasarlarını
       TOPLAMAZ. Hangisi güçlüyse o uygulanır (bkz. "en güçlü etki
       geçerli" — engine.js'te dotDps atandığı yerler), süre her isabette
       en son vuranınkine yenilenir. dotKind yalnızca hangi görselin
       (yeşil kabarcık / turuncu alev) çizileceğini belirler. */
    if(e.dotT > 0){
      if(e.dotKind === 'fire') burning = true;
      e.dotT -= dt;
      e.hp -= (e.dotDps||0) * dt * (1-(e.queenDmgResist||0));
      if(e.dotT <= 0){ e.dotT = 0; e.dotDps = 0; e.dotKind = null; }
    }
  });
  // Kavrulma cızırtısı kare başına bir kez denenir; playBurnTick kendi
  // içinde uzun aralıkla kısıtlı olduğu için kaç düşman yanarsa yansın
  // tek bir cızırtı duyulur.
  if(burning) playBurnTick();   // audio.js
  return newborns;
}

/* Kısa ömürlü dünya efektleri: şimşek yayları, küp enkazı, lazer
   ışınları ve iyileştirme birikintileri. Birikintiler ayrıca
   içlerindeki düşmanları iyileştirir. */
function updateTransientEffects(dt){
  arcs.forEach(a=>{ a.life -= dt; });
  arcs = arcs.filter(a=>a.life > 0);

  /* KÜP ENKAZI (bkz. "KÜP BÖLÜNMESİ") — yalnızca görsel, oynanışa etkisi yok */
  if(debris.length){
    debris.forEach(d=>{ d.life -= dt; });
    debris = debris.filter(d=>d.life > 0);
  }

  /* LAZER IŞINLARI — hasar zaten çakıldığı anda uygulandı; burada
     yalnızca görselin ömrü tükenir. Ölen/silinen hedefe bağlı ışın
     da hemen düşer, havada asılı kalmasın. */
  if(beams.length){
    beams.forEach(b=>{ b.life -= dt; });
    beams = beams.filter(b=>b.life > 0 && enemies.includes(b.target));
  }

  /* İYİLEŞTİRME BİRİKİNTİLERİ (kırılan şişelerden)
     Üst üste binen birikintiler toplanmaz; en güçlüsü uygulanır.
     Aksi halde birkaç şişe yan yana kırıldığında bölüm kilitlenir. */
  if(healZones.length){
    healZones.forEach(z=>{ z.life -= dt; });
    healZones = healZones.filter(z=>z.life > 0);

    if(healZones.length && enemies.length){
      enemies.forEach(e=>{
        let best = 0;
        for(let i=0;i<healZones.length;i++){
          const z = healZones[i];
          if(Math.hypot(e.x-z.x, e.y-z.y) <= z.r && z.healPerSec > best) best = z.healPerSec;
        }
        if(best > 0 && e.hp < e.maxHp){
          e.hp = Math.min(e.maxHp, e.hp + best*dt);
          e.healedT = 0.35;    // görsel geri bildirim için kısa işaret
        }
        if(e.healedT > 0) e.healedT -= dt;
      });
    }
  }
}

/* Yolun sonuna ulaşan düşmanlar can götürür.
   false → can bitti, bölüm kaybedildi. */
function applyLeaks(){
  const reachedEnd = e => e.dist >= (pathLens[e.pathIdx||0] || pathTotalLen);
  const reached = enemies.filter(reachedEnd);
  if(reached.length){
    let dmg=0; reached.forEach(e=>dmg+=e.dmgToLives);
    lives-=dmg; shake=Math.min(shake+8,16);
    playLifeLoss();
    enemies = enemies.filter(e=>!reachedEnd(e));
    document.getElementById('livesVal').textContent = Math.max(lives,0);
    if(lives<=0){ endGame(false); return false; }
  }
  return true;
}

/* Kuleleri işler: inşa/yükseltme sayacı, nişan açısının yumuşatılması
   ve atış (Ateş Kulesi kesintisiz lav huzmesi, Lazer Kulesi anında
   çakan ışın, diğerleri mermi). */
function updateTowers(dt){
  towers.forEach(t=>{
    // İnşa/yükseltme sürüyorsa kule çalışmaz; süre dolunca devreye girer.
    if(t.buildLeft > 0){
      t.flameOn = false;   // yükseltilirken lav huzmesi de kesilir
      t.buildLeft -= dt;
      if(t.buildLeft <= 0){
        t.buildLeft = 0;
        // Yükseltme tamamlandı: seviyeyi şimdi uygula ve kutla.
        if(t.pendingLevel !== undefined && t.pendingLevel !== null){
          t.level = t.pendingLevel;
          t.pendingLevel = null;
          // Kutlama parçacıkları kulenin kendi rengini alır
          for(let i=0;i<20;i++){
            const ang = (i/20)*Math.PI*2;
            particles.push({x:t.x,y:t.y-6,vx:Math.cos(ang)*90,vy:Math.sin(ang)*90-30,life:0.55,color:t.def.color});
          }
          floatTexts.push({x:t.x,y:t.y-26,text:'SEVİYE '+t.level,life:0.9,vy:-28,color:'#f4c04a'});
        } else {
          for(let i=0;i<10;i++){
            const ang=(i/10)*Math.PI*2;
            particles.push({x:t.x,y:t.y+4,vx:Math.cos(ang)*60,vy:Math.sin(ang)*40-20,life:0.4,color:t.def.color});
          }
        }
        playPlace();
        if(towerPanelOpen && selectedTower===t) renderTowerPanel();
      }
      return; // inşa bitene kadar ateş etme
    }

    const st = getTowerStats(t);
    const rateMult = towerRateMultiplier(t);
    t.cooldown = Math.max(0, t.cooldown-dt);
    if(t.overloadT > 0) t.overloadT -= dt;
    if(t.blindT > 0) t.blindT -= dt;

    /* NİŞAN ALMA: kule, ateş etmese bile menzilindeki hedefe döner.
       Namlu/yay anlık zıplamasın diye açı yumuşatılarak takip edilir. */
    const aimTarget = pickTarget(t, st.range);
    if(aimTarget){
      t.angle = Math.atan2(aimTarget.y - t.y, aimTarget.x - t.x);
    }
    if(t.aimAngle === undefined) t.aimAngle = t.angle !== undefined ? t.angle : -Math.PI/2;
    if(t.angle !== undefined){
      // En kısa yönden döndür (-π..π aralığına indirge)
      let diff = t.angle - t.aimAngle;
      while(diff >  Math.PI) diff -= Math.PI*2;
      while(diff < -Math.PI) diff += Math.PI*2;
      t.aimAngle += diff * Math.min(1, dt*7);
    }

    /* LAV HUZMESİ (Ateş Kulesi) — atış atış değil, hedef gördüğü sürece
       KESİNTİSİZ akar. Koni içindeki herkes her karede dps*dt kadar
       hasar alır; cooldown hiç kullanılmaz, bunun yerine dps hesabına
       aura yavaşlatması (rateMult) bölen olarak girer. */
    if(t.def.kind === 'fire'){
      // Aşırı yük / körlük gibi susturmalar cooldown üzerinden gelir:
      // huzme o süre boyunca kesilir.
      if(t.cooldown > 0 || !aimTarget){
        t.flameOn = false;
      } else {
        const aimAng = t.aimAngle;
        const cone = st.coneAngle;
        const dps = st.dmg / Math.max(0.05, st.rate * rateMult);
        enemies.forEach(e=>{
          if(Math.hypot(e.x-t.x, e.y-t.y) > st.range) return;
          let diff = Math.atan2(e.y-t.y, e.x-t.x) - aimAng;
          while(diff >  Math.PI) diff -= Math.PI*2;
          while(diff < -Math.PI) diff += Math.PI*2;
          if(Math.abs(diff) > cone) return;
          if(dps>0) e.hp -= dps*dt*(1-(e.queenDmgResist||0));
          e.flashT = Math.max(e.flashT||0, 0.35);
          // ATEŞ vs DON: aynı hedefte bir arada duramaz — lav,
          // üzerindeki yavaşlatmayı/donu hemen eritir.
          e.slowT = 0;
          // ATEŞ vs ZEHİR: ortak "yanma" yuvası — üst üste binmez,
          // en güçlü DPS uygular, süre bu temasla yenilenir.
          if(!(e.dotDps > st.burnDps)){ e.dotDps = st.burnDps; e.dotKind = 'fire'; }
          e.dotT = Math.max(e.dotT||0, st.burnDuration);
        });
        t.flameOn = true;
        t.flameAngle = aimAng;
        t.flameCone = cone;
        t.flameRange = st.range;
        t.pulse = 1;
        // Kesintisiz ateşte her karede ses çalmasın — kısa aralıkla döner
        t.flameSndT = (t.flameSndT||0) - dt;
        if(t.flameSndT <= 0){
          playShoot('fire', rangeVolume(Math.hypot(aimTarget.x-t.x, aimTarget.y-t.y), st.range));
          t.flameSndT = 0.32;
        }
      }
      if(t.pulse>0) t.pulse = Math.max(0,t.pulse-dt*2.5);
      return;
    }

    if(t.cooldown<=0){
      const target = aimTarget;
      if(target){
        /* Sesin uzaklık çarpanı: hedef menzilin dibindeyse 1, ucuna
           doğru kademeli olarak zayıflar (rangeVolume, audio.js).
           Menzil kulenin merkezinden ölçüldüğü için mesafe de namlu
           ucundan değil merkezden alınıyor. */
        const shotVol = rangeVolume(Math.hypot(target.x-t.x, target.y-t.y), st.range);
        if(t.def.kind === 'mage'){
          /* MAVİ LAZER — uçan mermi yok: ışın anında hedefe değer ve
             hasar aynı karede uygulanır. Kayıt hedefi referansla
             tuttuğu için görsel de düşmanı birebir takip eder. */
          const mz = muzzlePoint(t);
          applyDirectHit(t, target, st.dmg, mz.x, mz.y, shotVol);
          beams.push({tower:t, target, life:0.25, maxLife:0.25});
          playShoot('mage', shotVol);
        } else {
          const mz = muzzlePoint(t);
          const dist0 = Math.hypot(target.x-mz.x, target.y-mz.y);
          projectiles.push({x:mz.x,y:mz.y,target,dmg:st.dmg,splash:st.splash,kind:t.def.kind,
            // tx/ty: merminin gideceği NOKTA. Hedef yaşadığı sürece her
            // karede tazelenir; hedef ölürse mermi son bilinen bu noktaya
            // uçmaya devam eder (bkz. updateProjectiles).
            tx:target.x, ty:target.y,
            // volMult: atış anında dondurulan uzaklık çarpanı. İsabet
            // sesi de bunu kullanır, böylece atış ve patlama aynı
            // uzaklıkta duyulur (bkz. rangeVolume, audio.js).
            volMult:shotVol,
            ox:mz.x, oy:mz.y, tower:t,
            speed:t.def.kind==='mortar'?4.2:(t.def.kind==='bolt'?11:7),travel:dist0,
            slow:t.def.slowFactor,slowDuration:st.slowDuration,
            poisonDps:st.poisonDps, poisonDuration:st.poisonDuration,
            chainCount:st.chainCount, chainFalloff:st.chainFalloff, chainRange:st.chainRange});
          playShoot(t.def.kind, shotVol);
        }
        t.cooldown = st.rate * rateMult;
        t.pulse = 1;
      }
    }
    if(t.pulse>0) t.pulse = Math.max(0,t.pulse-dt*2.5);
  });
}

/* Mesafe kat etmeyen (anında değen) bir isabeti uygular — şu an
   yalnızca Lazer Kulesi kullanıyor. Mermi isabetiyle aynı kuralları
   izler: Kalkan Taşıyıcı önden gelen darbeyi seker, Yansıtıcı atan
   kuleyi aşırı yükleyebilir. originX/originY, kalkanın hangi yöne
   baktığının hesaplanabilmesi için darbenin geldiği noktadır. */
function applyDirectHit(tower, tgt, dmg, originX, originY, volMult){
  if(tgt.blockArc > 0){
    const inx = originX - tgt.x, iny = originY - tgt.y;
    const il = Math.hypot(inx, iny) || 1;
    const fx = Math.cos(tgt.angle||0), fy = Math.sin(tgt.angle||0);
    if((inx/il)*fx + (iny/il)*fy > Math.cos(tgt.blockArc)){
      tgt.blockFlash = 0.35;
      playShieldDeflect();   // audio.js
      floatTexts.push({x:tgt.x,y:tgt.y,text:'BLOKE',life:0.5,vy:-24,color:'#bcd2f0'});
      for(let i=0;i<4;i++) particles.push({x:tgt.x,y:tgt.y,vx:(Math.random()-0.5)*70,vy:(Math.random()-0.5)*70,life:0.25,color:'#dce8ff'});
      return false;
    }
  }
  tgt.hp -= dmg * (1-(tgt.queenDmgResist||0));
  tgt.flashT = 1;
  playHit(tgt.radius, tgt.boss, volMult);
  floatTexts.push({x:tgt.x,y:tgt.y,text:'-'+Math.round(dmg),life:0.6,vy:-30,color:'#bfe4ff'});
  for(let i=0;i<5;i++) particles.push({x:tgt.x,y:tgt.y,vx:(Math.random()-0.5)*90,vy:(Math.random()-0.5)*90,life:0.35,color:tower.def.color});

  /* YANSITICI: hasarın bir kısmını atan kuleye geri yansıtır;
     kule kısa süre aşırı yüklenip ateş edemez. */
  if(tgt.overloadSec > 0 && Math.random() < tgt.overloadChance){
    if(towers.includes(tower) && tower.buildLeft <= 0){
      tower.cooldown = Math.max(tower.cooldown, tgt.overloadSec);
      tower.overloadT = tgt.overloadSec;
      playReflectorShock();   // audio.js
      floatTexts.push({x:tower.x,y:tower.y-30,text:'AŞIRI YÜK',life:0.8,vy:-24,color:'#ffe066'});
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        particles.push({x:tower.x,y:tower.y-10,vx:Math.cos(a)*70,vy:Math.sin(a)*70,life:0.35,color:'#fff3a8'});
      }
    }
  }
  return true;
}

/* Mermileri hedefe taşır ve isabette hasarı, kalkan blokunu,
   yavaşlatma/zehir/ateş etkilerini ve şimşek zincirini uygular. */
function updateProjectiles(dt){
  projectiles.forEach(p=>{
    /* BALİSTİK: hedef yolda ölürse mermi HAVADA YOK OLMAZ. Nişan noktası
       (tx/ty) hedef yaşadığı sürece tazelenir; hedef düştüğü anda son
       bilinen konumda donar ve mermi oraya kadar uçup düşer.
       Havan güllesi için bu belirleyici: gülle yere indiğinde alan
       hasarı yine uygulanır, yani hedefi son anda ölen bir top atışı
       boşa gitmez — çevredeki düşmanlar patlamayı yer.
       Tek hedefli mermiler (ok, buz, zehir, şimşek) ise vuracak kimse
       kalmadığı için yere düşüp söner: hasar yok, yalnızca toz. */
    const alive = enemies.includes(p.target);
    if(alive){ p.tx = p.target.x; p.ty = p.target.y; }
    else p.target = null;

    const dx=p.tx-p.x, dy=p.ty-p.y, d=Math.hypot(dx,dy);
    const step = p.speed*dt*60;
    if(d < step+2){
      const ix=p.tx, iy=p.ty;
      if(p.splash>0){
        /* GÜLLE PATLAMASI — yarıçap içindeki HERKES tam hasar alır
           (kenara doğru azalma yok). Top ritmi seyrek olduğu için
           her isabetin ağır hissettirmesi gerekiyor: geniş şok
           dalgası, güçlü sarsıntı ve savrulan toprak/kor. */
        let caught = 0;
        enemies.forEach(e=>{
          if(Math.hypot(e.x-ix,e.y-iy)<=p.splash){
            e.hp -= p.dmg * (1-(e.queenDmgResist||0)); e.flashT=1;
            playHit(e.radius, e.boss, p.volMult);
            caught++;
          }
        });
        explosions.push({x:ix,y:iy,r:6,maxR:p.splash,life:0.5,blast:true});
        explosions.push({x:ix,y:iy,r:2,maxR:p.splash*0.55,life:0.3});
        shake=Math.min(shake+7,14);
        // Kaç düşman yakalandıysa o kadar çok enkaz savrulur
        const bits = 22 + Math.min(18, caught*3);
        for(let i=0;i<bits;i++){
          const a = Math.random()*Math.PI*2, sp = 70+Math.random()*170;
          particles.push({x:ix,y:iy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.3+Math.random()*0.35,
            color: i%3===0 ? '#fff0b8' : (i%3===1 ? '#e8a94a' : '#8a5a2a')});
        }
      } else if(!p.target){
        // Hedef yolda öldü ve bu mermi alan hasarı vermiyor: yere düşüp
        // söner. Görsel olarak "ıskaladı" hissi versin diye küçük bir toz.
        for(let i=0;i<4;i++){
          const a = Math.random()*Math.PI*2, sp = 30+Math.random()*50;
          particles.push({x:ix,y:iy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0.28,color:'#b8ad95'});
        }
      } else {
        const tgt = p.target;

        /* KALKAN TAŞIYICI: mermi önden geldiyse seker.
           Kalkan hareket yönüne bakar; atış kaynağı ile hareket
           yönü arasındaki açı dar ise darbe önden gelmiş demektir. */
        let blocked = false;
        if(tgt.blockArc > 0){
          const inx = (p.ox !== undefined ? p.ox : p.x) - tgt.x;
          const iny = (p.oy !== undefined ? p.oy : p.y) - tgt.y;
          const il = Math.hypot(inx, iny) || 1;
          const fx = Math.cos(tgt.angle||0), fy = Math.sin(tgt.angle||0);
          const dot = (inx/il)*fx + (iny/il)*fy;      // 1 = tam önden
          if(dot > Math.cos(tgt.blockArc)) blocked = true;
        }

        if(blocked){
          tgt.blockFlash = 0.35;
          playShieldDeflect();   // audio.js
          floatTexts.push({x:p.x,y:p.y,text:'BLOKE',life:0.5,vy:-24,color:'#bcd2f0'});
          for(let i=0;i<4;i++) particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*70,vy:(Math.random()-0.5)*70,life:0.25,color:'#dce8ff'});
        } else {
          if(p.dmg > 0){
            tgt.hp -= p.dmg * (1-(tgt.queenDmgResist||0)); tgt.flashT=1;
            if(p.kind==='bolt') playElectricHit(tgt.radius, tgt.boss, p.volMult); else playHit(tgt.radius, tgt.boss, p.volMult);
            floatTexts.push({x:p.x,y:p.y,text:'-'+Math.round(p.dmg),life:0.6,vy:-30,color:p.kind==='mage'?'#bfe4ff':'#ffe3c2'});

            /* YANSITICI: hasarın bir kısmını atan kuleye geri yansıtır.
               Kule kısa süre aşırı yüklenir ve ateş edemez. */
            if(tgt.overloadSec > 0 && p.tower && Math.random() < tgt.overloadChance){
              const tw = p.tower;
              if(towers.includes(tw) && tw.buildLeft <= 0){
                tw.cooldown = Math.max(tw.cooldown, tgt.overloadSec);
                tw.overloadT = tgt.overloadSec;
                playReflectorShock();   // audio.js
                floatTexts.push({x:tw.x,y:tw.y-30,text:'AŞIRI YÜK',life:0.8,vy:-24,color:'#ffe066'});
                for(let i=0;i<6;i++){
                  const a=(i/6)*Math.PI*2;
                  particles.push({x:tw.x,y:tw.y-10,vx:Math.cos(a)*70,vy:Math.sin(a)*70,life:0.35,color:'#fff3a8'});
                }
              }
            }
          }
          if(p.slow){
            tgt.slowT = p.slowDuration;
            tgt.slowFactor = p.slow;
            // ATEŞ vs DON: yavaşlatma sadece ALEVİ söndürür, zehiri değil.
            if(tgt.dotKind === 'fire'){ tgt.dotT = 0; tgt.dotDps = 0; tgt.dotKind = null; }
            if(p.dmg <= 0) tgt.flashT = 0.6;
          }
          // ZEHİR: ortak "yanma" yuvası — Ateş Kulesi ile üst üste
          // binmez, en güçlü DPS uygular, süre bu isabetle yenilenir.
          if(p.poisonDps > 0){
            if(!(tgt.dotDps > p.poisonDps)){ tgt.dotDps = p.poisonDps; tgt.dotKind = 'poison'; }
            tgt.dotT = Math.max(tgt.dotT||0, p.poisonDuration);
          }
          // ŞİMŞEK: hedeften yakındaki düşmanlara sıçra
          if(p.chainCount > 0){
            let cur = tgt;
            let dmg = p.dmg;
            const hitSet = new Set([cur]);
            for(let c=0;c<p.chainCount;c++){
              let next=null, bestD=Infinity;
              for(let i=0;i<enemies.length;i++){
                const e = enemies[i];
                if(hitSet.has(e)) continue;
                const d = Math.hypot(e.x-cur.x, e.y-cur.y);
                if(d <= p.chainRange && d < bestD){ bestD=d; next=e; }
              }
              if(!next) break;
              dmg *= p.chainFalloff;
              next.hp -= dmg * (1-(next.queenDmgResist||0)); next.flashT = 1;
              playElectricHit(next.radius, next.boss, p.volMult);
              arcs.push({x1:cur.x, y1:cur.y, x2:next.x, y2:next.y, life:0.22});
              floatTexts.push({x:next.x,y:next.y,text:'-'+Math.round(dmg),life:0.5,vy:-26,color:'#fff3a8'});
              hitSet.add(next);
              cur = next;
            }
          }
        }
        for(let i=0;i<5;i++) particles.push({x:ix,y:iy,vx:(Math.random()-0.5)*90,vy:(Math.random()-0.5)*90,life:0.35,
          color:p.kind==='ice'?'#bfeeff':(p.kind==='poison'?'#b9ea78':(p.kind==='bolt'?'#fff3a8':'#c9a56a'))});
      }
      p.dead=true;
    } else {
      p.x += dx/d*step; p.y += dy/d*step;
    }
  });
  projectiles = projectiles.filter(p=>!p.dead);
}

function updateExplosions(dt){
  explosions.forEach(x=>{ x.life-=dt; x.r += (x.maxR-x.r)*0.3; });
  explosions = explosions.filter(x=>x.life>0);
}

/* Canı biten düşmanlar: altın, ses, küp bölünmesi, şişe birikintisi,
   koza patlaması ve boss ölüm gösterisi. */
function resolveEnemyDeaths(){
  const dead = enemies.filter(e=>e.hp<=0);
  if(dead.length){
    const spawned = [];
    dead.forEach(e=>{
      gold += e.gold;
      addGoldEarnedStat(e.gold);
      playKill(e.boss);

      // KÜP BÖLÜNMESİ: ölen küp, canının ve boyutunun %40'ı kadar
      // iki yavru bırakır. splitsLeft bitene kadar zincir devam eder.
      if(e.splitsLeft > 0){
        playCubeSplit();   // audio.js
        // Kaçıncı küçülme olduğunu bul (1 = ilk küçülme)
        const gen = (e.splitsTotal || 0) - e.splitsLeft + 1;
        let childSpeed;
        if(e.splitSpeedMults && e.splitSpeedMults[gen-1] !== undefined){
          // Taban hıza göre kademeli çarpan (birikmeli değil)
          childSpeed = (e.baseSpeed || e.speed) * e.splitSpeedMults[gen-1];
        } else {
          childSpeed = e.speed * e.splitSpeedFactor;
        }
        for(let k=0;k<2;k++){
          const childHp = Math.max(1, e.maxHp * e.splitHpFactor);
          spawned.push({
            ...e,
            hp: childHp, maxHp: childHp,
            radius: Math.max(e.minRadius, e.radius * e.splitSizeFactor),
            speed: childSpeed,
            gold: Math.max(1, Math.round(e.gold*0.5)),
            splitsLeft: e.splitsLeft - 1,
            // yavrular yolda hafifçe ayrışsın ve farklı salınsın
            dist: Math.max(0, e.dist + (k===0 ? -10 : 10)),
            wobbleSeed: Math.random()*2.2,
            wobbleT: Math.random()*Math.PI*2,
            wobbleScale: 0.65 + Math.random()*0.7,
            wobblePhase2: Math.random()*Math.PI*2,
            spin: Math.random()*Math.PI*2,
            spinDir: Math.random()<0.5 ? -1 : 1,
            flashT: 0, slowT: e.slowT, slowFactor: e.slowFactor,
            bounce: Math.random()*10,
          });
        }
        for(let i=0;i<10;i++){
          const ang=(i/10)*Math.PI*2;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*100,vy:Math.sin(ang)*100,life:0.35,color:e.body});
        }

        // ENKAZ: kırılan şişenin yere döktüğü sıvı gibi, küpün
        // parçaları da bir süre yerde saçılı kalır (yalnızca görsel).
        const pieces = [];
        const pieceCount = 6 + Math.floor(Math.random()*3);
        for(let i=0;i<pieceCount;i++){
          const a = Math.random()*Math.PI*2, d = 6 + Math.random()*(e.radius*0.9);
          pieces.push({ dx:Math.cos(a)*d, dy:Math.sin(a)*d, rot:Math.random()*Math.PI, size:3+Math.random()*4 });
        }
        debris.push({ x:e.x, y:e.y, life:1.6, maxLife:1.6, color:e.body, color2:e.body2, pieces });
      }

      // ŞİŞE KIRILMASI: yere dökülen sıvı uzun süre iyileştirir
      if(e.healRadius > 0){
        healZones.push({
          x:e.x, y:e.y,
          r:e.healRadius,
          healPerSec:e.healPerSec,
          life:e.healDuration,
          maxLife:e.healDuration,
        });
        // Kırılma efekti: cam kırıkları + sıvı sıçraması
        for(let i=0;i<22;i++){
          const ang=(i/22)*Math.PI*2, sp=60+Math.random()*110;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.5,
            color: i%3===0 ? '#dffbe9' : '#7fe0a8'});
        }
        playFlaskShatter();   // audio.js
        floatTexts.push({x:e.x,y:e.y-16,text:'ŞİŞE KIRILDI',life:1.0,vy:-26,color:'#7fe0a8'});
      }

      // KIVILCIM PATLAMASI: ölünce geniş bir alana patlayıcı polen saçar;
      // yarıçaptaki kuleler bir süreliğine kör olup ateş edemez.
      if(e.deathBlindRadius > 0){
        let blinded = 0;
        towers.forEach(tw=>{
          if(tw.buildLeft > 0) return;   // inşa halindeki kule zaten ateş etmiyor
          if(Math.hypot(tw.x-e.x, tw.y-e.y) <= e.deathBlindRadius){
            tw.cooldown = Math.max(tw.cooldown, e.deathBlindDuration);
            tw.blindT = e.deathBlindDuration;
            blinded++;
          }
        });
        explosions.push({x:e.x,y:e.y,r:6,maxR:e.deathBlindRadius,life:0.5});
        shake = Math.min(shake+6, 16);
        playBlindBurst();
        for(let i=0;i<26;i++){
          const ang=(i/26)*Math.PI*2, sp=70+Math.random()*130;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.55,
            color: i%3===0 ? '#ffe08a' : (i%3===1 ? '#ff8a4a' : '#ffb35c')});
        }
        if(blinded>0) floatTexts.push({x:e.x,y:e.y-16,text:'KÖRLEŞTİ',life:0.9,vy:-26,color:'#ffb35c'});
      }

      if(e.boss){
        shake = Math.min(shake+14, 20);
        showWaveToast(e.label + ' Yıkıldı!'); // ui.js
        for(let i=0;i<60;i++){
          const ang=(i/60)*Math.PI*2, sp=80+Math.random()*180;
          particles.push({x:e.x,y:e.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:0.9,color:i%2?'#bfeeff':'#ffffff'});
        }
        explosions.push({x:e.x,y:e.y,r:8,maxR:e.auraRadius||120,life:0.6});
        floatTexts.push({x:e.x,y:e.y-30,text:'+'+e.gold+'🪙',life:1.2,vy:-30,color:'#f4c04a'});
      } else {
        floatTexts.push({x:e.x,y:e.y-10,text:'+'+e.gold+'🪙',life:0.7,vy:-25,color:'#f4c04a'});
        for(let i=0;i<12;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*120,vy:(Math.random()-0.5)*120,life:0.45,color:e.body});
      }
    });
    enemies = enemies.filter(e=>e.hp>0);
    if(spawned.length) enemies.push(...spawned);
    document.getElementById('goldVal').textContent = gold;
  }
}

function updateParticlesAndTexts(dt){
  particles.forEach(p=>{ p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt; });
  particles = particles.filter(p=>p.life>0);
  floatTexts.forEach(f=>{ f.y+=f.vy*dt; f.life-=dt; });
  floatTexts = floatTexts.filter(f=>f.life>0);
}
