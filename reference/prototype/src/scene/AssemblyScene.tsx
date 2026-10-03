import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { Vector3, Euler } from 'three';
import type { Manual } from '../schema/manual';
import type { Vec3 } from '../schema/parts';
import { resolveScene } from './resolveScene';
import { buildTracks, sample } from './tracks';
import { boundsOf, type Bounds } from './geometry';
import { DEFAULT_OPTIONS, TRAP_DURATION, type SceneOptions } from './constants';
import { PartMesh } from './PartMesh';
import { Ghost } from './Ghost';
import { MotionGuide } from './MotionGuide';
import { CameraRig } from './CameraRig';
export interface AssemblySceneProps {
  manual: Manual; stepIndex: number; playKey: number; playing: boolean; speed: number;
  scrubT: number|null; showTrap: boolean; onProgress: (t:number)=>void; onDone: ()=>void;
  options?: SceneOptions; resetKey?: number;
}
function World(props: AssemblySceneProps) {
  const {manual,stepIndex,playKey,playing,speed,scrubT,showTrap,onProgress,onDone,resetKey=0,options=DEFAULT_OPTIONS}=props;
  const step=manual.steps[stepIndex];
  const {before,after,tracks,totalDuration}=useMemo(()=>{
    const before=resolveScene(manual,stepIndex-1,options.hardwareScale),after=resolveScene(manual,stepIndex,options.hardwareScale);
    return {before,after,...buildTracks(step,before,after,options.hardwareScale)};
  },[manual,stepIndex,options.hardwareScale,step]);
  const trapDuration=showTrap&&step.orientationTrap?TRAP_DURATION:0;
  const duration=totalDuration+trapDuration;
  const clock=useRef(0),done=useRef(false),lastReport=useRef(-1);
  const [time,setTime]=useState(0);
  useFrame((_,dt)=>{
    if(scrubT!==null) {clock.current=scrubT*duration;done.current=false;}
    else if(playing) clock.current=Math.min(duration,clock.current+Math.min(dt,.1)*speed*options.globalSpeed);
    setTime(clock.current);
    if(Math.abs(clock.current-lastReport.current)>.03||clock.current===duration){onProgress(clock.current/duration);lastReport.current=clock.current;}
    if(clock.current>=duration&&!done.current&&scrubT===null){done.current=true;onDone();}
  });
  const motionTime=Math.max(0,time-trapDuration),poses=sample(tracks,motionTime);
  const groupPose=poses.get('assembly')??after.assemblyPose;
  const current=new Set(tracks.flatMap(t=>t.instanceId==='assembly'?[...after.instances.keys()]:[t.instanceId]));
  const trapPart=step.orientationTrap?manual.parts.find(p=>p.id===step.orientationTrap!.part):undefined;
  const trapInstance=trapPart?[...after.instances.values()].find(i=>i.partId===trapPart.id):undefined;
  const flipping=step.actions.some(a=>a.verb==='flip');
  const upright=flipping ? motionTime>=2 : before.assemblyPose.rotation.some(v=>v!==0);
  const focused=useMemo(()=>{
    const ids=new Set(after.stepActions.at(-1)?.flatMap(a=>[...a.instanceIds,`${a.action.target}#1`])??[]);
    const whole=stepIndex===0||flipping;
    const items=[...after.instances.values()].filter(i=>whole||ids.has(i.instanceId));
    const moving=tracks.filter(t=>t.instanceId!=='assembly').map(t=>({...after.instances.get(t.instanceId)!,position:t.from.position}));
    return boundsOf([...items,...moving]);
  },[after,tracks,stepIndex,flipping]);
  let cameraBounds:Bounds=focused;
  if(upright){
    const points:Vec3[]=[];
    for(const x of [focused.min[0],focused.max[0]])for(const y of [focused.min[1],focused.max[1]])for(const z of [focused.min[2],focused.max[2]]){
      const v=new Vector3(x,y,z).applyEuler(new Euler(...groupPose.rotation)).add(new Vector3(...groupPose.position));points.push([v.x,v.y,v.z]);
    }
    cameraBounds=boundsOf(points.map(position=>({position,sizeCm:[0,0,0]})));
  }
  return <>
    <color attach="background" args={['#fbfaf7']}/><hemisphereLight args={['#ffffff','#c6c2b8',2.2]}/>
    <directionalLight position={[-80,180,100]} intensity={2.5}/>
    <group position={groupPose.position} rotation={groupPose.rotation}>
      {[...after.instances.values()].map(instance=>{
        const part=manual.parts.find(p=>p.id===instance.partId)!;
        const hidden=trapDuration>0&&time<trapDuration&&instance.partId===trapPart?.id;
        return hidden?null:<PartMesh key={instance.instanceId} part={part} instance={instance} pose={poses.get(instance.instanceId)??instance} current={current.has(instance.instanceId)} features={options.features}/>;
      })}
      {options.guides&&time>=trapDuration&&tracks.map((track,i)=><MotionGuide key={i} track={track} time={motionTime}/>)}
      {trapDuration>0&&trapPart&&trapInstance&&<Ghost part={trapPart} instance={trapInstance} trap={step.orientationTrap!} time={time}/>}
    </group>
    {!upright&&<mesh rotation={[-Math.PI/2,0,0]} position={[73.5,-.3,38.5]}><planeGeometry args={[178,109]}/><meshStandardMaterial color="#e9e7df" roughness={1}/></mesh>}
    <ContactShadows position={[73.5,-.6,38.5]} scale={330} opacity={.22} blur={2.8} far={180} resolution={256}/>
    {options.axes&&<axesHelper args={[65]}/>}
    <CameraRig bounds={cameraBounds} upright={upright} frameKey={`${stepIndex}-${playKey}-${resetKey}`}/>
  </>;
}
export function AssemblyScene(props: AssemblySceneProps) {
  return <Canvas camera={{position:[-110,220,290],fov:30,near:.1,far:2500}} dpr={[1,2]} gl={{antialias:true}} fallback={<div className="canvas-fallback">3D needs WebGL. You can still follow the original diagrams.</div>}>
    <World key={`${props.manual.id}-${props.stepIndex}-${props.playKey}-${props.options?.hardwareScale}`} {...props}/>
  </Canvas>;
}
