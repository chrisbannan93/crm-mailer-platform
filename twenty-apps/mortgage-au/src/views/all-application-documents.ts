import { defineView } from 'twenty-sdk';

export const ALL_APPLICATION_DOCUMENTS_VIEW_UNIVERSAL_IDENTIFIER = 'e1189aea-2a1d-40a5-bbb4-5c8ec72bafa0';

export default defineView({
  universalIdentifier: ALL_APPLICATION_DOCUMENTS_VIEW_UNIVERSAL_IDENTIFIER,
  name: 'all-application-documents',
  objectUniversalIdentifier: '7c6e421c-6bf7-476a-9736-5cb9b74d5d65',
  icon: 'IconListCheck',
  position: 0,
  fields: [
    {
      universalIdentifier: '626fd63f-0bf7-496e-8536-c48535156a9b',
      fieldMetadataUniversalIdentifier: '06e545f4-f52c-490e-8333-69c7adbd4927',
      position: 0,
      isVisible: true,
    },
    {
      universalIdentifier: '67eb08cf-bdca-459e-9424-f254dc2268ed',
      fieldMetadataUniversalIdentifier: 'ad7d153c-0f6e-4de1-9af3-a6fbb59eb0b4',
      position: 1,
      isVisible: true,
    },
    {
      universalIdentifier: '4026b0b1-9e0e-441d-adc0-38d04050b244',
      fieldMetadataUniversalIdentifier: '4b8f9a2d-af67-4c96-b2d1-129e2bf6d5a7',
      position: 2,
      isVisible: true,
    },
    {
      universalIdentifier: '8ff7f844-9330-4b12-860f-306a34374304',
      fieldMetadataUniversalIdentifier: '47eb5fa7-d619-4e5a-9f82-650a8f00af69',
      position: 3,
      isVisible: true,
    },
  ],
});
