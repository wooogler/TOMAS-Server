import { FastifyInstance, FastifyRequest } from "fastify";
import multer from 'fastify-multer'
import { Configuration, OpenAIApi } from "openai";

interface MulterRequest extends FastifyRequest {
  file: any;
}

async function routes (server: FastifyInstance) {
  const fs = require('fs')
  const upload = multer({ dest: 'upload/', preservePath: true })
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
  })
  const openai = new OpenAIApi(configuration);

  server.get('/', async (request, reply) => {
    return { hello: 'world'}
  })
  
  server.post('/transcribe', { preHandler: upload.single('audio_chunk') }, async (request, reply) => {
    // we can use the `request.body` object to get the data sent by the client
    const audio_chunk = await (request as MulterRequest).file
    const response = await openai.createTranscription(
      fs.createReadStream(audio_chunk.path),
      "whisper-1"
    );
    reply.code(200).send({ "transcription": response.data.text })
  })
}
  
export default routes;