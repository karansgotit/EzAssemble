import type { Step } from '../schema/step';
import { Icon } from './Icon';
export function ConfidenceBanner({step}: {step:Step}) {
  return <>{step.confidence==='low'&&<div className="confidence-banner" role="note"><Icon name="alert" size={19}/><span>The AI is unsure about this step — double-check the original diagram.</span><small>DEMO CONFIDENCE</small></div>}{step.note&&<p className="step-note">{step.note}</p>}</>;
}
