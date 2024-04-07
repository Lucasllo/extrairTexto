import { Injectable, BadRequestException } from '@nestjs/common';
import _ = require('lodash');
import {
  TextractClient,
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import { readFile } from 'fs/promises';

@Injectable()
export class AppService {
  client = new TextractClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
  });

  getKeyValueMap = (blocks) => {
    const keyMap = {};
    const valueMap = {};
    const blockMap = {};

    let blockId;
    blocks.forEach((block) => {
      blockId = block.Id;
      blockMap[blockId] = block;

      if (block.BlockType === 'KEY_VALUE_SET') {
        if (_.includes(block.EntityTypes, 'KEY')) {
          keyMap[blockId] = block;
        } else {
          valueMap[blockId] = block;
        }
      }
    });

    return { keyMap, valueMap, blockMap };
  };

  findValueBlock = (keyBlock, valueMap) => {
    let valueBlock;
    keyBlock.Relationships.forEach((relationship) => {
      if (relationship.Type === 'VALUE') {
        relationship.Ids.every((valueId) => {
          if (_.has(valueMap, valueId)) {
            valueBlock = valueMap[valueId];
            return false;
          }
        });
      }
    });

    return valueBlock;
  };

  getText = (result, blocksMap) => {
    let text = '';

    if (_.has(result, 'Relationships')) {
      result.Relationships.forEach((relationship) => {
        if (relationship.Type === 'CHILD') {
          relationship.Ids.forEach((childId) => {
            const word = blocksMap[childId];
            if (word.BlockType === 'WORD') {
              text += `${word.Text} `;
            }
            if (word.BlockType === 'SELECTION_ELEMENT') {
              if (word.SelectionStatus === 'SELECTED') {
                text += `X `;
              }
            }
          });
        }
      });
    }

    return text.trim();
  };

  getKeyValueRelationship = (keyMap, valueMap, blockMap) => {
    const keyValues = {};

    const keyMapValues = _.values(keyMap);

    keyMapValues.forEach((keyMapValue) => {
      const valueBlock = this.findValueBlock(keyMapValue, valueMap);
      const key = this.getText(keyMapValue, blockMap);
      const value = this.getText(valueBlock, blockMap);
      keyValues[key] = value;
    });

    return keyValues;
  };

  async extractText(file, filtro) {
    try {
      //read
      const buf =
        file == null
          ? await readFile('./src/assets/BoletoBancario.png')
          : file.buffer;
      //send to aws
      const res = new AnalyzeDocumentCommand({
        Document: { Bytes: buf },
        FeatureTypes: ['FORMS'],
      });

      const respons = await this.client.send(res);
      //parse the result
      if (res && respons.Blocks) {
        const { keyMap, valueMap, blockMap } = this.getKeyValueMap(
          respons.Blocks,
        );
        const keyValues = this.getKeyValueRelationship(
          keyMap,
          valueMap,
          blockMap,
        );

        let retorno;
        if (filtro != null) {
          retorno = keyValues[filtro];
        } else {
          retorno = keyValues;
        }
        if (retorno == null) {
          throw new BadRequestException('Campo invalido!');
        }
        return retorno;
      }
    } catch (err) {
      throw new BadRequestException(err);
    }
  }

  async extractTextExternal(file: Express.Multer.File) {
    return this.extractText(file, null);
  }

  async extractTextExternalFilter(file: Express.Multer.File, filtro) {
    return this.extractText(file, filtro);
  }

  async extractTextExternalAllLines(file: Express.Multer.File) {
    try {
      //read
      const buf = file.buffer;
      //send to aws
      const res = new DetectDocumentTextCommand({
        Document: { Bytes: buf },
      });

      const respons = await this.client.send(res);
      //parse the result

      return respons.Blocks.filter((i) => i.BlockType === 'LINE')
        .map((i) => i.Text)
        .join('\n');
    } catch (err) {
      console.error(err);
    }
  }
}
