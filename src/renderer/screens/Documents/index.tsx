import type { Job } from '@shared/types';
import Icon from '../../components/Icon';

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
  onDownload,
  onGenerate,
}: {
  type: string;
  hasDoc: boolean;
  filename?: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onGenerate?: () => void;
}) {
  if (!hasDoc) {
    return (
      <div className="doc-card empty">
        <PdfThumb empty />
        <div className="doc-info">
          <div className="doc-type">{type}</div>
          <div className="empty-note">
            Not generated yet. Evaluate the role first, then generate from the Jobs view.
          </div>
          <div className="doc-foot">
            <button className="mini-btn accent" onClick={onGenerate} disabled={!onGenerate}>
              <Icon name="sparkle" size={13} /> Generate
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
          <button className="mini-btn" onClick={onDownload}>
            <Icon name="download" size={13} /> Download
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

export default function Documents({ jobs, collapsed, onExpand }: DocumentsProps) {
  const relevant = jobs.filter(
    (j) => j.pdfPath || j.coverLetterPdfPath || j.score !== null
  );

  const handleOpen = async (path: string) => {
    try {
      await window.api.invoke('shell:open', path);
    } catch {}
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
                  onDownload={() => job.pdfPath && handleOpen(job.pdfPath)}
                />
                <DocCard
                  type="Cover letter"
                  hasDoc={!!job.coverLetterPdfPath}
                  filename={job.coverLetterPdfPath ?? undefined}
                  onOpen={() => job.coverLetterPdfPath && handleOpen(job.coverLetterPdfPath)}
                  onDownload={() => job.coverLetterPdfPath && handleOpen(job.coverLetterPdfPath)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
