import type { Step } from '../schema/step';
import { DiagramPanel } from './DiagramPanel';
import { Icon } from './Icon';
export function InfoStep({step}: {step:Step}) {
  return <section className="info-step"><div className="info-step-banner"><span className="info-icon"><Icon name="book"/></span><div><strong>A little help from the original.</strong><p>No 3D for this step — follow the diagram</p></div><span className="tag">WALL MOUNTING</span></div><DiagramPanel stepNumber={step.stepNumber} large/></section>;
}
