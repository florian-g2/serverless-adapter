import { HttpsOptions } from 'firebase-functions/lib/v2/providers/https';
import {
  FrameworkContract,
  ServerlessRequest,
  ServerlessResponse,
  waitForStreamComplete,
} from '../../src';
import { HttpFirebaseV2Handler } from '../../src/handlers/firebase/http-firebase-v2.handler';
import { FrameworkMock } from '../mocks/framework.mock';

jest.mock('firebase-admin', () => {
  const packages = {
    '12.x': 'firebase-admin-8',
    latest: 'firebase-admin',
  };
  const version = process.env.TEST_NODE_VERSION || 'latest';

  // Require the original module.
  const originalModule = jest.requireActual(packages[version]);

  return {
    __esModule: true,
    ...originalModule,
  };
});

describe(HttpFirebaseV2Handler.name, () => {
  it('should forward correctly the request to framework', async () => {
    const handlerFactory = new HttpFirebaseV2Handler();

    const method = 'POST';
    const url = '/users/batata';
    const headers = { 'Content-Type': 'application/json' };
    const remoteAddress = '168.16.0.1';
    const body = Buffer.from('{"test": true}', 'utf-8');

    const request = new ServerlessRequest({
      method,
      url,
      headers,
      remoteAddress,
      body,
    });

    const response = new ServerlessResponse({
      method,
    });

    const responseBody = { batata: true };
    const responseStatus = 200;
    const framework = new FrameworkMock(responseStatus, responseBody);

    const handler = handlerFactory.getHandler(null, framework);

    handler(request, response);

    await waitForStreamComplete(response);

    expect(response.statusCode).toBe(responseStatus);
    expect(ServerlessResponse.body(response).toString()).toStrictEqual(
      JSON.stringify(responseBody),
    );
  });

  it('should handle weird body types', () => {
    const handlerFactory = new HttpFirebaseV2Handler();

    const method = 'POST';
    const url = '/users/batata';
    const headers = { 'Content-Type': 'application/json' };
    const remoteAddress = '168.16.0.1';
    const options = [{ potato: true }, [{ test: true }]];

    for (const option of options) {
      const request = new ServerlessRequest({
        method,
        url,
        headers,
        remoteAddress,
        body: option as any,
      });

      const response = new ServerlessResponse({
        method,
      });

      const framework: FrameworkContract<unknown> = {
        sendRequest: jest.fn(
          async (
            app: null,
            req: ServerlessRequest,
            res: ServerlessResponse,
          ) => {
            expect(req.body?.toString()).toEqual(JSON.stringify(option));
            expect(req.headers['content-length']).toEqual(
              Buffer.byteLength(JSON.stringify(option)).toString(),
            );

            req.pipe(res);

            await waitForStreamComplete(res);

            expect(ServerlessResponse.body(res).toString()).toEqual(
              JSON.stringify(option),
            );
          },
        ),
      };

      const handler = handlerFactory.getHandler(null, framework);

      handler(request, response);
    }
  });

  it('should forward the properties to https.onRequest', () => {
    const options: HttpsOptions = {
      concurrency: 400,
    };
    const factory = new HttpFirebaseV2Handler(options);

    const spyMethod = jest.spyOn(factory, 'onRequestWithOptions' as any);

    factory.getHandler(null, new FrameworkMock(200, {}));

    expect(spyMethod).toHaveBeenCalledWith(options, expect.any(Function));
  });
});
