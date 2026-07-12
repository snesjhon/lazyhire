import type { AnswerEntry, Job } from '@shared/types';
import Answers from '../screens/Answers';
import Drawer from './Drawer';

interface Props {
  job: Job;
  answers: AnswerEntry[];
  onAnswersChange: (answers: AnswerEntry[]) => void;
  onClose: () => void;
}

export default function AnswersDrawer({ job, answers, onAnswersChange, onClose }: Props) {
  return (
    <Drawer open title={`Answers · ${job.company}`} onClose={onClose} width={460}>
      <Answers answers={answers} onAnswersChange={onAnswersChange} job={job} embedded />
    </Drawer>
  );
}
