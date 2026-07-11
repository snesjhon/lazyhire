import { useState, useEffect } from 'react';
import './styles/globals.css';
import Sidebar, { type Screen } from './components/Sidebar';
import Icon from './components/Icon';
import Jobs from './screens/Dashboard';
import Documents from './screens/Documents';
import Answers from './screens/Answers';
import Scan from './screens/Scan';
import Profile from './screens/Profile';
import Settings from './screens/Settings';
import Welcome from './screens/Welcome';
import Spinner from './components/Spinner';
import { IPC } from '@shared/ipc-channels';
import type { Job, AnswerEntry, Profile as ProfileType } from '@shared/types';

function StatusBar({ jobsCount }: { jobsCount: number }) {
  return (
    <div className="statusbar">
      <span className="sb-item"><span className="sb-key">1 2 3</span> panels</span>
      <span className="sb-item"><span className="sb-key">a</span> add job</span>
      <span className="sb-right">
        <span className="live-dot" /> {jobsCount} roles · local
      </span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('jobs');
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('lh-theme') as 'light' | 'dark') || 'dark'
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('lh-collapsed') === '1'
  );

  const [jobs, setJobs] = useState<Job[]>([]);
  const [answers, setAnswers] = useState<AnswerEntry[]>([]);
  const [candidateName, setCandidateName] = useState<string | undefined>();
  const [candidateTitle, setCandidateTitle] = useState<string | undefined>();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lh-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('lh-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    window.api.invoke(IPC.JOBS_LIST)
      .then((list) => setJobs(list as Job[]))
      .catch(() => {});
    window.api.invoke(IPC.ANSWERS_LIST)
      .then((list) => setAnswers(list as AnswerEntry[]))
      .catch(() => {});
    window.api.invoke(IPC.PROFILE_HAS)
      .then(async (has) => {
        setHasProfile(Boolean(has));
        if (!has) return;
        const profile = await window.api.invoke(IPC.PROFILE_READ) as ProfileType;
        setCandidateName(profile.candidate?.name);
        setCandidateTitle(profile.headline);
      })
      .catch(() => setHasProfile(false));
  }, []);

  const docsCount = jobs.filter((j) => j.pdfPath || j.coverLetterPdfPath).length;

  const navigate = (s: Screen) => setScreen(s);

  if (hasProfile === null) {
    return (
      <div className="app-shell">
        <div className="drag-bar" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size={16} />
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="app-shell">
        <div className="drag-bar" />
        <Welcome
          onComplete={(p) => {
            setHasProfile(true);
            setCandidateName(p.candidate.name);
            setCandidateTitle(p.headline);
          }}
        />
      </div>
    );
  }

  return (
    <div className={'app-shell' + (collapsed ? ' sidebar-collapsed' : '')}>
      {/* Floating controls when collapsed */}
      <div className="floating-controls">
        <div className="lights">
          <span className="light r" />
          <span className="light y" />
          <span className="light g" />
        </div>
        <div className="fc-div" />
        <button className="exp-btn" onClick={() => setCollapsed(false)} title="Show sidebar">
          <Icon name="sidebarToggle" size={17} />
        </button>
      </div>

      <div className="app-body">
        <Sidebar
          active={screen}
          onNavigate={navigate}
          theme={theme}
          onThemeChange={setTheme}
          onCollapse={() => setCollapsed(true)}
          jobsCount={jobs.length}
          docsCount={docsCount}
          answersCount={answers.length}
          candidateName={candidateName}
          candidateTitle={candidateTitle}
        />

        {screen === 'jobs' && (
          <Jobs
            jobs={jobs}
            onJobsChange={setJobs}
            onGoDocuments={() => setScreen('docs')}
            onGoAnswers={() => setScreen('answers')}
            collapsed={collapsed}
          />
        )}
        {screen === 'docs' && <Documents jobs={jobs} onJobsChange={setJobs} collapsed={collapsed} />}
        {screen === 'answers' && (
          <Answers
            answers={answers}
            onAnswersChange={setAnswers}
            collapsed={collapsed}
          />
        )}
        {screen === 'scan' && <Scan />}
        {screen === 'profile' && <Profile />}
        {screen === 'settings' && <Settings />}
      </div>

      <StatusBar jobsCount={jobs.length} />
    </div>
  );
}
