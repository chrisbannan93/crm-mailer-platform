#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const envPathArg = process.argv.find((arg) => arg.startsWith('--env='));
const envPath = envPathArg
  ? envPathArg.slice('--env='.length)
  : path.resolve(cwd, 'connector/.env');
const shouldReset = !args.has('--no-reset');

const env = readEnv(envPath);
const apiUrl = `${required(env, 'TWENTY_BASE_URL')}/graphql`;
const apiKey = required(env, 'TWENTY_API_KEY');
const brokerOwner = env.MORTGAGE_BROKER_NAME || 'Chris Bannan';

const activeRetailAmounts = [780000, 820000, 695000, 910000, 640000, 1050000, 860000, 740000, 1120000, 830000, 905000];
const activeCommercialAmounts = [1450000, 1320000, 1180000, 1620000, 980000, 1050000, 1650000];
const settledAmounts = [610000, 890000, 730000, 1240000, 980000, 660000, 1510000, 845000, 920000];

const peopleBlueprints = [
  ['Ava', 'Mercer', 'Senior Product Designer', 'Sydney', '+61411000001'],
  ['Liam', 'Hart', 'Software Engineering Manager', 'Melbourne', '+61411000002'],
  ['Zoe', 'Collins', 'Physiotherapist', 'Brisbane', '+61411000003'],
  ['Ethan', 'Walsh', 'Project Director', 'Perth', '+61411000004'],
  ['Mia', 'Donnelly', 'Solicitor', 'Newcastle', '+61411000005'],
  ['Noah', 'Fraser', 'Civil Engineer', 'Geelong', '+61411000006'],
  ['Grace', 'Ellery', 'HR Consultant', 'Sunshine Coast', '+61411000007'],
  ['Lucas', 'Bennett', 'Electrician', 'Adelaide', '+61411000008'],
  ['Isla', 'Morton', 'Marketing Lead', 'Canberra', '+61411000009'],
  ['Jack', 'Reeves', 'Operations Analyst', 'Gold Coast', '+61411000010'],
  ['Chloe', 'Sinclair', 'Speech Pathologist', 'Hobart', '+61411000011'],
  ['Mason', 'Bryant', 'Managing Director', 'Sydney', '+61411000012'],
  ['Olivia', 'Keane', 'Finance Manager', 'Melbourne', '+61411000013'],
  ['Henry', 'Lawson', 'Builder', 'Brisbane', '+61411000014'],
  ['Sophie', 'Dalton', 'Veterinarian', 'Perth', '+61411000015'],
  ['Archie', 'Vaughan', 'Commercial Agent', 'Sydney', '+61411000016'],
  ['Ruby', 'Mercer', 'Occupational Therapist', 'Melbourne', '+61411000017'],
  ['Thomas', 'Reid', 'Dentist', 'Brisbane', '+61411000018'],
  ['Amelia', 'Brooks', 'Business Owner', 'Adelaide', '+61411000019'],
  ['Benjamin', 'Kerr', 'Chartered Accountant', 'Perth', '+61411000020'],
  ['Matilda', 'Shaw', 'Pharmacist', 'Sydney', '+61411000021'],
  ['James', 'Porter', 'Procurement Lead', 'Melbourne', '+61411000022'],
  ['Lily', 'Grant', 'Teacher', 'Brisbane', '+61411000023'],
  ['William', 'Sloane', 'Hospitality Director', 'Sydney', '+61411000024'],
  ['Poppy', 'Jenkins', 'Interior Architect', 'Melbourne', '+61411000025'],
  ['Charlie', 'Hughes', 'Medical Specialist', 'Brisbane', '+61411000026'],
  ['Evie', 'Dawson', 'Retail Operations Manager', 'Perth', '+61411000027'],
];

const lenders = ['CBA', 'Westpac', 'ANZ', 'NAB', 'Macquarie', 'Firstmac', 'Liberty', 'Pepper Money'];
const commercialEntities = [
  ['Mercer Property Group Pty Ltd', 'COMPANY', '93451278123', 'COMMERCIAL_PROPERTY'],
  ['Harbour View Investments Pty Ltd', 'COMPANY', '48621933491', 'COMMERCIAL_PROPERTY'],
  ['Dalton Family Trust', 'TRUST', '11987234102', 'RESIDENTIAL_SECURITY'],
  ['Northside Logistics Pty Ltd', 'COMPANY', '52876341029', 'CASHFLOW'],
  ['Reid Medical Holdings Pty Ltd', 'COMPANY', '44761023891', 'COMMERCIAL_PROPERTY'],
  ['Sloane Hospitality Group Pty Ltd', 'COMPANY', '65102837418', 'COMMERCIAL_PROPERTY'],
  ['Porter Industrial Trust', 'TRUST', '20193847561', 'CASHFLOW'],
  ['Brooks Advisory Partners', 'PARTNERSHIP', '58910372641', 'OTHER'],
  ['Jenkins Design Studio Pty Ltd', 'COMPANY', '37019284567', 'COMMERCIAL_PROPERTY'],
];

const retailStages = [
  'DOCS_REQUESTED',
  'DISCOVERY_BOOKED',
  'FACT_FIND_COMPLETE',
  'DOCS_REQUESTED',
  'DOCS_COMPLETE',
  'SERVICING_ASSESSED',
  'SUBMITTED',
  'CONDITIONAL_APPROVAL',
  'FORMAL_APPROVAL',
  'LEAD_CAPTURED',
  'DOCS_REQUESTED',
];
const commercialStages = [
  'DEAL_STRUCTURING',
  'CREDIT_PAPER_READY',
  'DOCS_REQUESTED',
  'INDICATIVE_OFFER',
  'SUBMITTED',
  'DOCS_COMPLETE',
  'CONDITIONAL_APPROVAL',
];
const settledStages = Array.from({ length: 9 }, () => 'SETTLED');

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

function required(envObject, key) {
  const value = envObject[key];
  if (!value) throw new Error(`Missing ${key} in ${envPath}`);
  return value;
}

async function graphql(query, variables = {}) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from Twenty: ${text}`);
  }

  if (!response.ok || body.errors) {
    throw new Error(`Twenty GraphQL error: ${JSON.stringify(body.errors || body)}`);
  }
  return body.data;
}

function isoDaysAgo(daysAgo, hour = 9) {
  const date = new Date(Date.UTC(2026, 2, 1, hour, 0, 0));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

function isoDaysFromNow(daysAhead, hour = 9) {
  const date = new Date(Date.UTC(2026, 2, 1, hour, 0, 0));
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString();
}

function money(amount) {
  return { amountMicros: amount * 1000000, currencyCode: 'AUD' };
}

function blocknote(markdown) {
  return JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: markdown }] }]);
}

function makeLeadSlug(firstName, lastName) {
  return `${firstName}.${lastName}`.toLowerCase();
}

function buildPeople() {
  return peopleBlueprints.map(([firstName, lastName, jobTitle, city, phone], index) => ({
    key: `person-${index + 1}`,
    firstName,
    lastName,
    jobTitle,
    city,
    phone,
    email: `${makeLeadSlug(firstName, lastName)}@harbourlane-demo.test`,
    createdAt: isoDaysAgo(175 - index * 5, 10),
    updatedAt: isoDaysAgo(Math.max(6, 175 - index * 5 - 2), 11),
  }));
}

function pickRetailPurpose(index) {
  return ['PURCHASE', 'REFINANCE', 'PURCHASE', 'INVESTMENT', 'PURCHASE', 'CONSTRUCTION'][index % 6];
}

function pickCommercialPurpose(index) {
  return ['WORKING_CAPITAL', 'PURCHASE', 'REFINANCE', 'INVESTMENT'][index % 4];
}

function pickLvr(value) {
  if (value < 0.6) return 'LT_60';
  if (value < 0.7) return 'OPT60_70';
  if (value < 0.8) return 'OPT70_80';
  if (value < 0.9) return 'OPT80_90';
  return 'GT_90';
}

function buildApplications(people) {
  const applications = [];
  let appCounter = 1;

  activeRetailAmounts.forEach((loanAmount, index) => {
    const person = people[index];
    const propertyValue = Math.round(loanAmount / (0.74 + (index % 4) * 0.04));
    applications.push({
      appId: `APP-${String(appCounter++).padStart(3, '0')}`,
      personKey: person.key,
      borrowerName: `${person.firstName} ${person.lastName}`,
      applicationtype: 'RETAIL_HOME_LOAN',
      pipelinestage: retailStages[index],
      loanpurpose: pickRetailPurpose(index),
      loanamount: loanAmount,
      estimatedpropertyvalue: propertyValue,
      lvrband: pickLvr(loanAmount / propertyValue),
      occupancytype: index % 3 === 0 ? 'INVESTMENT' : 'OWNER_OCCUPIED',
      firsthomebuyer: index === 0 || index === 4,
      lenderTarget: lenders[index % lenders.length],
      targetSettlementDate: isoDaysFromNow(12 + index * 3),
      brokerOwner,
      notesSummary: `${retailStages[index].toLowerCase().replaceAll('_', ' ')} on a retail home loan file for ${person.city}.`,
      createdAt: isoDaysAgo(165 - index * 6),
      updatedAt: isoDaysAgo(Math.max(2, 40 - index * 2)),
    });
  });

  activeCommercialAmounts.forEach((loanAmount, offset) => {
    const index = 11 + offset;
    const person = people[index];
    const [entityName, entitytype, abn, securitytype] = commercialEntities[offset % commercialEntities.length];
    const propertyValue = Math.round(loanAmount / (0.68 + (offset % 3) * 0.05));
    applications.push({
      appId: `APP-${String(appCounter++).padStart(3, '0')}`,
      personKey: person.key,
      borrowerName: `${person.firstName} ${person.lastName}`,
      applicationtype: 'COMMERCIAL_LOAN',
      pipelinestage: commercialStages[offset],
      loanpurpose: pickCommercialPurpose(offset),
      loanamount: loanAmount,
      estimatedpropertyvalue: propertyValue,
      lvrband: pickLvr(loanAmount / propertyValue),
      lenderTarget: lenders[(offset + 3) % lenders.length],
      targetSettlementDate: isoDaysFromNow(18 + offset * 5),
      brokerOwner,
      entityname: entityName,
      entitytype,
      abn,
      securitytype,
      notesSummary: `${commercialStages[offset].toLowerCase().replaceAll('_', ' ')} commercial structure for ${entityName}.`,
      createdAt: isoDaysAgo(150 - offset * 7),
      updatedAt: isoDaysAgo(Math.max(2, 28 - offset * 2)),
    });
  });

  settledAmounts.forEach((loanAmount, offset) => {
    const index = 18 + offset;
    const person = people[index];
    const isCommercial = offset % 3 === 0;
    const propertyValue = Math.round(loanAmount / (isCommercial ? 0.71 : 0.78));
    const entityData = commercialEntities[(offset + 2) % commercialEntities.length];
    applications.push({
      appId: `APP-${String(appCounter++).padStart(3, '0')}`,
      personKey: person.key,
      borrowerName: `${person.firstName} ${person.lastName}`,
      applicationtype: isCommercial ? 'COMMERCIAL_LOAN' : 'RETAIL_HOME_LOAN',
      pipelinestage: settledStages[offset],
      loanpurpose: isCommercial ? pickCommercialPurpose(offset) : pickRetailPurpose(offset),
      loanamount: loanAmount,
      estimatedpropertyvalue: propertyValue,
      lvrband: pickLvr(loanAmount / propertyValue),
      occupancytype: isCommercial ? undefined : offset % 2 === 0 ? 'OWNER_OCCUPIED' : 'INVESTMENT',
      firsthomebuyer: !isCommercial && offset === 2,
      lenderTarget: lenders[(offset + 5) % lenders.length],
      targetSettlementDate: isoDaysAgo(50 - offset * 4),
      brokerOwner,
      entityname: isCommercial ? entityData[0] : undefined,
      entitytype: isCommercial ? entityData[1] : undefined,
      abn: isCommercial ? entityData[2] : undefined,
      securitytype: isCommercial ? entityData[3] : undefined,
      notesSummary: isCommercial
        ? `Settled commercial facility with post-settlement review queued.`
        : `Settled retail file with annual review journey active.`,
      createdAt: isoDaysAgo(140 - offset * 9),
      updatedAt: isoDaysAgo(45 - offset * 3),
    });
  });

  return applications;
}

function retailDocuments(app) {
  const statusSet = app.pipelinestage === 'SETTLED'
    ? ['ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED']
    : app.pipelinestage === 'DOCS_REQUESTED'
      ? ['RECEIVED', 'REQUEST', 'REQUEST', 'MISSING', 'RECEIVED']
      : app.pipelinestage === 'DOCS_COMPLETE'
        ? ['RECEIVED', 'RECEIVED', 'RECEIVED', 'REQUEST', 'RECEIVED']
        : app.pipelinestage === 'SUBMITTED' || app.pipelinestage === 'CONDITIONAL_APPROVAL' || app.pipelinestage === 'FORMAL_APPROVAL'
          ? ['ACCEPTED', 'ACCEPTED', 'RECEIVED', 'RECEIVED', 'ACCEPTED']
          : ['REQUEST', 'REQUEST', 'MISSING', 'MISSING', 'REQUEST'];
  return [
    ['id', 'ID', 'ADMIN'],
    ['payslips_or_income_proof', 'Payslips / income proof', 'ADMIN'],
    ['bank_statements', 'Bank statements', 'ADMIN'],
    ['living_expenses', 'Living expenses summary', 'BROKER'],
    ['privacy_consent', 'Privacy consent', 'BROKER'],
  ].map(([key, label, ownerRole], index) => ({
    name: `${app.appId} - ${label}`,
    decumentkey: key,
    documentLabel: label,
    required: true,
    status: statusSet[index],
    ownerrole: ownerRole,
    notes: statusSet[index] === 'MISSING' ? 'Still waiting on borrower upload.' : 'Tracked in document pack.',
  }));
}

function commercialDocuments(app) {
  const statusSet = app.pipelinestage === 'SETTLED'
    ? ['ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED']
    : app.pipelinestage === 'DOCS_REQUESTED'
      ? ['REQUEST', 'REQUEST', 'REQUEST', 'MISSING', 'RECEIVED']
      : app.pipelinestage === 'DOCS_COMPLETE' || app.pipelinestage === 'SUBMITTED' || app.pipelinestage === 'CONDITIONAL_APPROVAL'
        ? ['ACCEPTED', 'RECEIVED', 'RECEIVED', 'RECEIVED', 'ACCEPTED']
        : ['REQUEST', 'REQUEST', 'MISSING', 'REQUEST', 'REQUEST'];
  return [
    ['director_id', 'Director identification', 'ADMIN'],
    ['financials', 'Last 2 years financial statements', 'ADMIN'],
    ['bas_returns', 'BAS returns', 'BROKER'],
    ['lease_or_rent_roll', 'Lease schedule / rent roll', 'BROKER'],
    ['privacy_consent', 'Privacy consent', 'BROKER'],
  ].map(([key, label, ownerRole], index) => ({
    name: `${app.appId} - ${label}`,
    decumentkey: key,
    documentLabel: label,
    required: true,
    status: statusSet[index],
    ownerrole: ownerRole,
    notes: statusSet[index] === 'MISSING' ? 'Awaiting borrower or accountant.' : 'Stored in commercial file.',
  }));
}

function buildTask(app, assigneeId) {
  const appNumber = Number(app.appId.replace('APP-', '')) || 1;
  if (app.pipelinestage === 'SETTLED') {
    return {
      title: `${app.appId} Post-settlement review touchpoint`,
      status: 'DONE',
      dueAt: isoDaysAgo(12),
      bodyV2: richText(`Annual review journey queued for ${app.borrowerName}.`),
      assigneeId,
      createdAt: isoDaysAgo(25),
      updatedAt: isoDaysAgo(11),
    };
  }

  const missingDocs = app.pipelinestage === 'DOCS_REQUESTED' || app.pipelinestage === 'FACT_FIND_COMPLETE';
  return {
    title: missingDocs ? `${app.appId} Chase missing documents` : `${app.appId} Broker follow-up`,
    status: app.pipelinestage === 'CONDITIONAL_APPROVAL' || app.pipelinestage === 'FORMAL_APPROVAL' ? 'IN_PROGRESS' : 'TODO',
    dueAt: isoDaysFromNow(1 + (appNumber % 6)),
    bodyV2: richText(
      missingDocs
        ? `Follow up on checklist gaps and prepare the file for the next stage.\n\nApplication: ${app.appId}`
        : `Update the borrower on lender progress and confirm next action.\n\nApplication: ${app.appId}`,
    ),
    assigneeId,
    createdAt: isoDaysAgo(18),
    updatedAt: isoDaysAgo(3),
  };
}

function richText(markdown) {
  return { markdown, blocknote: blocknote(markdown) };
}

function buildNotes(app, person) {
  const base = [
    {
      title: `${app.appId} Discovery captured`,
      bodyV2: richText(`Discovery captured for ${app.borrowerName}.\n\nLoan purpose: ${app.loanpurpose.replaceAll('_', ' ').toLowerCase()}\nBroker: ${app.brokerOwner}`),
      createdAt: app.createdAt,
      updatedAt: app.createdAt,
    },
    {
      title: `${app.appId} Stage update`,
      bodyV2: richText(`Pipeline stage is now ${app.pipelinestage.replaceAll('_', ' ').toLowerCase()}.\n\nLender target: ${app.lenderTarget}\nBorrower city: ${person.city}`),
      createdAt: isoDaysAgo(Math.max(4, daysAgoFromIso(app.updatedAt))),
      updatedAt: isoDaysAgo(Math.max(4, daysAgoFromIso(app.updatedAt))),
    },
  ];

  if (app.pipelinestage === 'SETTLED') {
    base.push({
      title: `${app.appId} Settlement confirmed`,
      bodyV2: richText(`Settlement has been confirmed for ${app.borrowerName}.\n\nTrail and review journey remain active.`),
      createdAt: app.updatedAt,
      updatedAt: app.updatedAt,
    });
  }

  return base;
}

function daysAgoFromIso(value) {
  const now = new Date(Date.UTC(2026, 2, 1, 9, 0, 0));
  const date = new Date(value);
  return Math.max(1, Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

async function queryWorkspaceState() {
  return graphql(`
    query SeedWorkspaceSnapshot {
      workspaceMembers {
        edges { node { id userEmail } }
      }
      people {
        edges { node { id emails { primaryEmail } } }
      }
      loanApplications {
        edges { node { id applicationid } }
      }
      applicationDocuments {
        edges { node { id } }
      }
      tasks {
        edges { node { id } }
      }
      taskTargets {
        edges { node { id } }
      }
      notes {
        edges { node { id } }
      }
      noteTargets {
        edges { node { id } }
      }
      companies {
        edges { node { id } }
      }
    }
  `);
}

async function destroyExisting(snapshot) {
  const destroy = async (mutationName, ids) => {
    for (const id of ids) {
      await graphql(`mutation Destroy($id: UUID!) { ${mutationName}(id: $id) { id } }`, { id });
    }
  };

  await destroy('destroyTaskTarget', snapshot.taskTargets.edges.map((edge) => edge.node.id));
  await destroy('destroyNoteTarget', snapshot.noteTargets.edges.map((edge) => edge.node.id));
  await destroy('destroyTask', snapshot.tasks.edges.map((edge) => edge.node.id));
  await destroy('destroyNote', snapshot.notes.edges.map((edge) => edge.node.id));
  await destroy('destroyApplicationDocument', snapshot.applicationDocuments.edges.map((edge) => edge.node.id));
  await destroy('destroyLoanApplication', snapshot.loanApplications.edges.map((edge) => edge.node.id));
  await destroy('destroyPerson', snapshot.people.edges.map((edge) => edge.node.id));
}

async function createPerson(person) {
  const data = await graphql(
    `mutation CreatePerson($data: PersonCreateInput!) {
      createPerson(data: $data) { id createdAt }
    }`,
    {
      data: {
        name: { firstName: person.firstName, lastName: person.lastName },
        emails: { primaryEmail: person.email },
        phones: {
          primaryPhoneNumber: person.phone,
          primaryPhoneCountryCode: 'AU',
          primaryPhoneCallingCode: '+61',
        },
        jobTitle: person.jobTitle,
        city: person.city,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      },
    },
  );
  return data.createPerson.id;
}

async function createLoanApplication(app, personId) {
  const data = await graphql(
    `mutation CreateLoanApplication($data: LoanApplicationCreateInput!) {
      createLoanApplication(data: $data) { id applicationid }
    }`,
    {
      data: {
        name: `${app.appId} · ${app.borrowerName}`,
        applicationid: app.appId,
        applicationtype: app.applicationtype,
        pipelinestage: app.pipelinestage,
        borrowername: app.borrowerName,
        brokerowner: app.brokerOwner,
        loanpurpose: app.loanpurpose,
        loanamount: money(app.loanamount),
        estimatedpropertyvalue: money(app.estimatedpropertyvalue),
        lvrband: app.lvrband,
        targetsettlementdate: app.targetSettlementDate,
        lendertarget: app.lenderTarget,
        ...(app.occupancytype ? { occupancytype: app.occupancytype } : {}),
        ...(app.firsthomebuyer !== undefined ? { firsthomebuyer: app.firsthomebuyer } : {}),
        ...(app.entityname ? { entityname: app.entityname } : {}),
        ...(app.entitytype ? { entitytype: app.entitytype } : {}),
        ...(app.abn ? { abn: app.abn } : {}),
        ...(app.securitytype ? { securitytype: app.securitytype } : {}),
        notessummary: app.notesSummary,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      },
    },
  );

  try {
    await graphql(
      `mutation LinkPersonToLoanApp($id: UUID!, $data: PersonUpdateInput!) {
        updatePerson(id: $id, data: $data) { id }
      }`,
      {
        id: personId,
        data: {
          loanapplications: {
            connect: {
              where: { id: data.createLoanApplication.id },
            },
          },
        },
      },
    );
  } catch (error) {
    console.warn(`Warning: failed linking person ${personId} to ${app.appId}: ${error.message}`);
  }

  return data.createLoanApplication.id;
}

async function createApplicationDocument(appId, doc, index) {
  const data = await graphql(
    `mutation CreateApplicationDocument($data: ApplicationDocumentCreateInput!) {
      createApplicationDocument(data: $data) { id }
    }`,
    {
      data: {
        ...doc,
        loanApplicationRefId: appId,
        recievedat: doc.status === 'RECEIVED' || doc.status === 'ACCEPTED' ? isoDaysAgo(12 - Math.min(index, 5)) : null,
        validatedat: doc.status === 'ACCEPTED' ? isoDaysAgo(8 - Math.min(index, 3)) : null,
        createdAt: isoDaysAgo(20 - Math.min(index, 10)),
        updatedAt: isoDaysAgo(3),
      },
    },
  );
  return data.createApplicationDocument.id;
}

async function createTask(task) {
  const data = await graphql(
    `mutation CreateTask($data: TaskCreateInput!) {
      createTask(data: $data) { id }
    }`,
    { data: task },
  );
  return data.createTask.id;
}

async function createTaskTarget(taskId, personId, loanApplicationId) {
  await graphql(
    `mutation CreateTaskTarget($data: TaskTargetCreateInput!) {
      createTaskTarget(data: $data) { id }
    }`,
    {
      data: {
        taskId,
        targetPersonId: personId,
        targetLoanApplicationId: loanApplicationId,
      },
    },
  );
}

async function createNote(note) {
  const data = await graphql(
    `mutation CreateNote($data: NoteCreateInput!) {
      createNote(data: $data) { id }
    }`,
    { data: note },
  );
  return data.createNote.id;
}

async function createNoteTarget(noteId, personId, loanApplicationId) {
  await graphql(
    `mutation CreateNoteTarget($data: NoteTargetCreateInput!) {
      createNoteTarget(data: $data) { id }
    }`,
    {
      data: {
        noteId,
        targetPersonId: personId,
        targetLoanApplicationId: loanApplicationId,
      },
    },
  );
}

(async function main() {
  const snapshot = await queryWorkspaceState();
  const assigneeId = snapshot.workspaceMembers.edges[0]?.node?.id;
  if (!assigneeId) throw new Error('No workspace member available to assign tasks');

  if (shouldReset) {
    await destroyExisting(snapshot);
  }

  const people = buildPeople();
  const applications = buildApplications(people);
  const personIds = new Map();
  const applicationIds = new Map();

  for (const person of people) {
    const id = await createPerson(person);
    personIds.set(person.key, id);
  }

  for (const app of applications) {
    const personId = personIds.get(app.personKey);
    const appRecordId = await createLoanApplication(app, personId);
    applicationIds.set(app.appId, appRecordId);

    const docs = app.applicationtype === 'COMMERCIAL_LOAN' ? commercialDocuments(app) : retailDocuments(app);
    for (const [index, doc] of docs.entries()) {
      await createApplicationDocument(appRecordId, doc, index);
    }

    const taskId = await createTask(buildTask(app, assigneeId));
    await createTaskTarget(taskId, personId, appRecordId);

    const person = people.find((entry) => entry.key === app.personKey);
    for (const note of buildNotes(app, person)) {
      const noteId = await createNote(note);
      await createNoteTarget(noteId, personId, appRecordId);
    }
  }

  const activeApps = applications.filter((app) => app.pipelinestage !== 'SETTLED').length;
  const settledApps = applications.filter((app) => app.pipelinestage === 'SETTLED').length;
  const activeValue = applications
    .filter((app) => app.pipelinestage !== 'SETTLED')
    .reduce((sum, app) => sum + app.loanamount, 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        reset: shouldReset,
        people: people.length,
        loanApplications: applications.length,
        activeApplications: activeApps,
        settledApplications: settledApps,
        pipelineValueAud: activeValue,
        note: 'Workspace seeded with mortgage demo data.',
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
