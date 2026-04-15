/** @jsxImportSource @opentui/react */
import type { UiTheme } from '../../../shared/ui/theme.js';
import type { Profile } from '../../../shared/models/types.js';
import {
  DetailFields,
  DetailHeading,
  DetailList,
  DetailParagraph,
} from '../../../shared/ui/DetailBlocks.js';
import type { ProfileActionView } from './ProfileActionWorkspace.js';

export const PROFILE_OPTIONS: Array<{
  name: string;
  description: string;
  value: ProfileActionView;
}> = [
  {
    name: 'Candidate',
    description: 'Identity and contact details',
    value: 'candidate',
  },
  {
    name: 'Education & Certifications',
    description: 'ATS-safe resume entries',
    value: 'education',
  },
  {
    name: 'Target Roles',
    description: 'Comma-separated role titles',
    value: 'roles',
  },
  {
    name: 'Categories',
    description: 'Broad role families',
    value: 'categories',
  },
  {
    name: 'Focuses',
    description: 'Narrower specializations',
    value: 'focuses',
  },
  {
    name: 'Salary Range',
    description: 'Minimum and maximum target comp',
    value: 'salary-min',
  },
  {
    name: 'Remote Preference',
    description: 'Full remote, hybrid, or any',
    value: 'remote',
  },
  {
    name: 'Deal-Breakers',
    description: 'Things to avoid',
    value: 'deal-breakers',
  },
];

export function renderProfileDashboardDetail(
  theme: UiTheme,
  profile: Profile,
  activeOption: (typeof PROFILE_OPTIONS)[number] | null,
) {
  if (!activeOption) {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Profile</DetailHeading>
        <DetailParagraph
          theme={theme}
          content="Select a profile item."
          marginBottom={0}
        />
      </box>
    );
  }

  if (activeOption.value === 'candidate') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <box flexBasis={2}>
          <DetailHeading theme={theme}>Candidate</DetailHeading>
        </box>
        <box flexBasis={8}>
          <DetailFields
            fields={[
              { label: 'Name', value: profile.candidate.name },
              { label: 'Headline', value: profile.headline },
              { label: 'Email', value: profile.candidate.email },
              { label: 'Location', value: profile.candidate.location },
              ...(profile.candidate.site
                ? [{ label: 'Site', value: profile.candidate.site }]
                : []),
            ]}
          />
        </box>
        <box flexGrow={1}>
          <DetailParagraph
            theme={theme}
            content="This section controls the candidate identity used across generated answers and application materials."
            marginBottom={0}
          />
        </box>
        <box flexBasis={2}>
          <text fg={theme.footer} content="Edit: <enter>" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'roles') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Target Roles</DetailHeading>
        <DetailFields
          fields={[
            {
              label: 'Current Value',
              value: profile.targets.roles.join(', ') || 'none',
            },
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="These titles define the roles you want to be matched against during discovery and evaluation."
          marginBottom={0}
        />
        <box flexGrow={1} />
        <box flexDirection="row" columnGap={1}>
          <text fg={theme.footer} content="Edit: <enter>" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'education') {
    const currentValue =
      profile.education.length > 0
        ? profile.education.map((entry) =>
            [entry.institution, entry.degree].filter(Boolean).join(' | '),
          )
        : ['none'];

    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <box flexBasis={2}>
          <DetailHeading theme={theme}>
            Education & Certifications
          </DetailHeading>
        </box>
        <box flexBasis={2}>
          <DetailList theme={theme} items={currentValue} />
        </box>
        <box flexGrow={1}>
          <DetailParagraph
            theme={theme}
            content="Each entry should stay on one ATS-safe line so the institution and credential are parsed together."
            marginBottom={0}
          />
        </box>
        <box flexBasis={2}>
          <text fg={theme.footer} content="enter=edit" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'categories') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Categories</DetailHeading>
        <DetailFields
          fields={[
            {
              label: 'Current Value',
              value: profile.targets.categories.join(', ') || 'none',
            },
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="Broad job families used to classify roles and improve ranking."
          marginBottom={0}
        />
        <box flexGrow={1} />
        <box flexDirection="row" columnGap={1}>
          <text fg={theme.footer} content="enter=edit" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'focuses') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Focuses</DetailHeading>
        <DetailFields
          fields={[
            {
              label: 'Current Value',
              value: profile.targets.focuses.join(', ') || 'none',
            },
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="Narrower specialties that indicate the strongest fit areas within a category."
          marginBottom={0}
        />
        <box flexGrow={1} />
        <box flexDirection="row" columnGap={1}>
          <text fg={theme.footer} content="enter=edit" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'salary-min') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Salary Range</DetailHeading>
        <DetailFields
          fields={[
            {
              label: 'Current Value',
              value: `$${profile.targets.salaryMin.toLocaleString()} - $${profile.targets.salaryMax.toLocaleString()}`,
            },
          ]}
        />
        <DetailParagraph
          theme={theme}
          content="This compensation band is used when evaluating whether a role meets your expectations."
          marginBottom={0}
        />
        <box flexGrow={1} />
        <box flexDirection="row" columnGap={1}>
          <text fg={theme.footer} content="enter=edit" />
        </box>
      </box>
    );
  }

  if (activeOption.value === 'remote') {
    return (
      <box flexDirection="column" width="100%" flexGrow={1}>
        <DetailHeading theme={theme}>Remote Preference</DetailHeading>
        <DetailFields
          fields={[{ label: 'Current Value', value: profile.targets.remote }]}
        />
        <DetailParagraph
          theme={theme}
          content="This setting influences search relevance and job evaluation."
          marginBottom={0}
        />
        <box flexGrow={1} />
        <box flexDirection="row" columnGap={1}>
          <text fg={theme.footer} content="enter=edit" />
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      <DetailHeading theme={theme}>Deal-Breakers</DetailHeading>
      <DetailFields
        fields={[
          {
            label: 'Current Value',
            value: profile.targets.dealBreakers.join(', ') || 'none',
          },
        ]}
      />
      <DetailParagraph
        theme={theme}
        content="These constraints should lower confidence in roles that do not match your requirements."
        marginBottom={0}
      />
      <box flexGrow={1} />
      <box flexDirection="row" columnGap={1}>
        <text fg={theme.footer} content="enter=edit" />
      </box>
    </box>
  );
}
