import { useState } from 'react';
import type { Job } from '@shared/types';
import { IPC } from '@shared/ipc-channels';
import Icon from '../../components/Icon';
import GenerateDocumentDrawer, { type GenerateSubmission } from '../../components/GenerateDocumentDrawer';

function getLogoChar(company: string) {
  return company.trim().charAt(0).toUpperCase();
}

function PdfThumb({ empty }: { empty?: boolean }) {
  if (empty) {
    return (
      <div className="pdf-thumb empty-thumb">
        <Icon name="plus" size={16} style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }
  return (
    <div className="pdf-thumb">
      <div className="lines">
        {[90, 70, 80, 60, 75, 50].map((w, i) => (
          <i key={i} style={{ width: w + '%' }} />
        ))}
      </div>
      <span className="pdf-tag">PDF</span>
    </div>
  );
}

function DocCard({
  type,
  hasDoc,
  filename,
  onOpen,
  onShowInFolder,
  onGenerate,
  generating,
}: {
  type: string;
  hasDoc: boolean;
  filename?: string;
  onOpen?: () => void;
  onShowInFolder?: () => void;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  if (!hasDoc) {
    return (
      <div className="doc-card empty">
        <PdfThumb empty />
        <div className="doc-info">
          <div className="doc-type">{type}</div>
          <div className="empty-note">Not generated yet.</div>
          <div className="doc-foot">
            <button className="mini-btn accent" onClick={onGenerate} disabled={!onGenerate || generating}>
              {generating
                ? <span className="spinner" style={{ width: 11, height: 11 }} />
                : <><Icon name="sparkle" size={13} /> Generate</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-card">
      <PdfThumb />
      <div className="doc-info">
        <div className="doc-type">{type}</div>
        {filename && <div className="doc-file">{filename.split('/').pop()}</div>}
        <div className="doc-foot">
          <button className="mini-btn" onClick={onOpen}>
            <Icon name="open" size={13} /> Open
          </button>
          <button className="mini-btn" onClick={onShowInFolder} title="Show in Folder">
            <Icon name="folder" size={13} /> Show in Folder
          </button>
          <button className="mini-btn" onClick={onGenerate} disabled={!onGenerate || generating}>
            {generating
              ? <span className="spinner" style={{ width: 11, height: 11 }} />
              : <><Icon name="sparkle" size={13} /> Re-generate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DocumentsProps {
  jobs: Job[];
  onJobsChange: (jobs: Job[]) => void;
  collapsed: boolean;
  onExpand: () => void;
}

export default function Documents({ jobs, onJobsChange, collapsed, onExpand }: DocumentsProps) {
  const relevant = jobs.filter(
    (j) => j.pdfPath || j.coverLetterPdfPath || j.score !== null
  );

  const [generateTarget, setGenerateTarget] = useState<{ job: Job; type: 'resume' | 'cover-letter' } | null>(null);
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());

  const handleOpen = async (path: string) => {
    try {
      await window.api.invoke(IPC.SHELL_OPEN_PATH, path);
    } catch {}
  };

  const handleShowInFolder = async (path: string) => {
    try {
      await window.api.invoke(IPC.SHELL_SHOW_ITEM_IN_FOLDER, path);
    } catch {}
  };

  const updateJob = (updated: Job) => {
    onJobsChange(jobs.map((j) => (j.id === updated.id ? updated : j)));
  };

  const handleGenerateSubmit = async (submission: GenerateSubmission) => {
    const key = `${submission.job.id}:${submission.type}`;
    setGeneratingKeys((prev) => new Set(prev).add(key));
    try {
      if (submission.type === 'resume') {
        const result = await window.api.invoke(IPC.AI_GENERATE_RESUME, {
          jobId: submission.job.id,
          tailoringNotes: submission.tailoringNotes,
          bulletWordRange: submission.bulletWordRange,
          textSizeScale: submission.textSizeScale,
        }) as { pdfPath: string };
        updateJob({ ...submission.job, pdfPath: result.pdfPath, theme: 'resume' });
      } else {
        const result = await window.api.invoke(IPC.AI_GENERATE_COVER_LETTER, {
          jobId: submission.job.id,
          tailoringNotes: submission.tailoringNotes,
          totalWordCount: submission.totalWordCount,
          tone: submission.tone,
        }) as { pdfPath: string };
        updateJob({ ...submission.job, coverLetterPdfPath: result.pdfPath, theme: 'cover-letter' });
      }
    } catch {
      // surfaced via unchanged doc state; user can retry
    } finally {
      setGeneratingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="main">
      <div className={'view-head' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div className="view-title-row">
            {collapsed && (
              <button className="expand-btn" onClick={onExpand} title="Show sidebar">
                <Icon name="sidebarToggle" size={17} />
              </button>
            )}
            <div className="view-title">Documents</div>
          </div>
          <div className="view-sub">Tailored resumes and cover letters, attached to each role</div>
        </div>
      </div>

      <div className="docs-scroll">
        {relevant.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 60 }}>
            <Icon name="docs" size={36} />
            <div className="es-title">No documents yet</div>
            <div className="es-sub">
              Evaluate a job and generate a resume or cover letter from the Jobs view.
            </div>
          </div>
        ) : (
          relevant.map((job) => (
            <div className="doc-group" key={job.id}>
              <div className="doc-group-head">
                <div className="logo" style={{ width: 30, height: 30, fontSize: 12 }}>
                  {getLogoChar(job.company)}
                </div>
                <div>
                  <div className="dg-role">{job.role}</div>
                  <div className="dg-company">{job.company}</div>
                </div>
              </div>
              <div className="doc-cards">
                <DocCard
                  type="Resume"
                  hasDoc={!!job.pdfPath}
                  filename={job.pdfPath ?? undefined}
                  onOpen={() => job.pdfPath && handleOpen(job.pdfPath)}
                  onShowInFolder={() => job.pdfPath && handleShowInFolder(job.pdfPath)}
                  onGenerate={() => setGenerateTarget({ job, type: 'resume' })}
                  generating={generatingKeys.has(`${job.id}:resume`)}
                />
                <DocCard
                  type="Cover letter"
                  hasDoc={!!job.coverLetterPdfPath}
                  filename={job.coverLetterPdfPath ?? undefined}
                  onOpen={() => job.coverLetterPdfPath && handleOpen(job.coverLetterPdfPath)}
                  onShowInFolder={() => job.coverLetterPdfPath && handleShowInFolder(job.coverLetterPdfPath)}
                  onGenerate={() => setGenerateTarget({ job, type: 'cover-letter' })}
                  generating={generatingKeys.has(`${job.id}:cover-letter`)}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {generateTarget && (
        <GenerateDocumentDrawer
          type={generateTarget.type}
          job={generateTarget.job}
          onClose={() => setGenerateTarget(null)}
          onSubmit={handleGenerateSubmit}
        />
      )}
    </div>
  );
}
