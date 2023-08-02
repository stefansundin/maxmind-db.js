// https://maxmind.github.io/MaxMind-DB/

export default class MaxMindDB {
  private buffer: undefined | ArrayBuffer;
  private search_tree_size: undefined | number;
  private data_section_start: undefined | number;
  private ipv4_start: undefined | number;
  private _metadata: undefined | object;

  async load(data: ArrayBuffer | Blob | File | Response): Promise<void> {
    if (data instanceof ArrayBuffer) {
      this.buffer = data;
    } else {
      this.buffer = await data.arrayBuffer();
    }
    this.search_tree_size = undefined;
    this.data_section_start = undefined;
    this.ipv4_start = undefined;
    this._metadata = undefined;
  }

  get metadata(): any {
    if (this._metadata) {
      return this._metadata;
    }
    if (!this.buffer) {
      throw new Error('Database not loaded');
    }

    const header = this.string2Uint8Array('\xab\xcd\xefMaxMind.com');
    let position;
    for (
      position = this.buffer.byteLength - header.length - 1;
      position > this.buffer.byteLength - 300;
      position--
    ) {
      if (
        this.equal(
          new Uint8Array(this.buffer.slice(position, position + header.length)),
          header,
        )
      ) {
        break;
      }
    }
    if (position === this.buffer.byteLength - 300) {
      throw new Error('Metadata section not found');
    }

    const metadata_start = position + header.length;
    const [, , map] = this.decode(metadata_start);
    this._metadata = map;

    this.search_tree_size = ((map.record_size * 2) / 8) * map.node_count;
    this.data_section_start = this.search_tree_size + 16;

    return this._metadata;
  }

  get(ip: string): Array<any> {
    const addr = this.packIP(ip);
    const [r] = this.record(addr);
    return r;
  }

  record(addr: ArrayBuffer): Array<any> {
    const [pointer, depth] = this.find_address_in_tree(addr);
    if (pointer === 0) {
      return [null, depth];
    }

    return [this.resolve_data_pointer(pointer), depth];
  }

  resolve_data_pointer(pointer: number): Array<any> {
    if (!this.buffer || !this.search_tree_size) {
      throw new Error('Database not loaded');
    }

    const offset_in_file =
      pointer - this.metadata.node_count + this.search_tree_size;

    if (offset_in_file >= this.buffer.byteLength) {
      throw new Error('The search tree is corrupt');
    }

    return this.decode(offset_in_file);
  }

  find_address_in_tree(addr: ArrayBuffer): Array<number> {
    const bit_count = 8 * addr.byteLength;
    const node_count = this.metadata.node_count;
    const view = new DataView(addr);

    let node = this.start_node(bit_count);
    let depth = 0;
    while (true) {
      if (depth >= bit_count || node >= node_count) {
        break;
      }
      const c = view.getUint8(depth >>> 3);
      const bit = 1 & (c >>> (7 - (depth % 8)));
      node = this.read_node(node, bit);
      depth++;
    }

    if (node === node_count) {
      return [0, depth];
    } else if (node > node_count) {
      return [node, depth];
    }

    throw new Error('Invalid node in search tree');
  }

  start_node(addr_length: number): number {
    if (addr_length === 128) {
      return 0;
    } else if (this.ipv4_start) {
      return this.ipv4_start;
    }

    let node = 0;
    if (this.metadata.ip_version === 6) {
      for (let i = 0; i < 96; i++) {
        if (node >= this.metadata.node_count) {
          break;
        }
        node = this.read_node(node, 0);
      }
    }

    this.ipv4_start = node;
    return this.ipv4_start;
  }

  read_node(node_number: number, index: number): number {
    if (!this.buffer) {
      throw new Error('Database not loaded');
    }

    const node_byte_size = this.metadata.record_size / 4;
    const base_offset = node_number * node_byte_size;
    const record_size = this.metadata.record_size;
    const view = new DataView(this.buffer);

    if (record_size === 24) {
      const offset = index === 0 ? base_offset : base_offset + 3;
      const bytes = new Uint8Array(4);
      bytes[0] = 0;
      bytes[1] = view.getUint8(offset);
      bytes[2] = view.getUint8(offset + 1);
      bytes[3] = view.getUint8(offset + 2);
      const view2 = new DataView(bytes.buffer);
      return view2.getUint32(0, false);
    } else if (record_size === 28) {
      if (index === 0) {
        const n = view.getUint32(base_offset);
        const last24 = n >>> 8;
        const first4 = (n & 0xf0) << 20;
        return first4 | last24;
      }
      const n = view.getUint32(base_offset + 3);
      return n & 0x0fffffff;
    } else if (record_size === 32) {
      const offset = index === 0 ? base_offset : base_offset + 4;
      const n = view.getUint32(offset);
      return n;
    }

    throw new Error(`Unsupported record size: ${record_size}`);
  }

  decode(position: number): Array<any> {
    if (!this.buffer) {
      throw new Error('Database not loaded');
    }

    const view = new DataView(this.buffer);
    let ctrl_byte = view.getUint8(position);
    position += 1;
    let type = ctrl_byte >>> 5;
    let size = ctrl_byte & 0x1f;

    if (type === 0) {
      // extended type
      ctrl_byte = view.getUint8(position);
      position += 1;
      type = ctrl_byte + 7;
    }

    if (type === 1) {
      if (!this.data_section_start) {
        throw new Error('Metadata not initialized');
      }
      // pointer
      const ptr_size = (ctrl_byte >>> 3) & 0x03;
      const ptr_value = ctrl_byte & 0x07;
      let value = this.data_section_start;
      if (ptr_size === 0) {
        // If the size is 0, the pointer is built by appending the next byte to the last three bits to produce an 11-bit value.
        const bytes = new Uint8Array(2);
        bytes.set([ptr_value, view.getUint8(position)]);
        const view2 = new DataView(bytes.buffer);
        value += view2.getUint16(0, false);
      } else if (ptr_size === 1) {
        // If the size is 1, the pointer is built by appending the next two bytes to the last three bits to produce a 19-bit value + 2048.
        const bytes = new Uint8Array(4);
        bytes.set([
          0,
          ptr_value,
          view.getUint8(position),
          view.getUint8(position + 1),
        ]);
        const view2 = new DataView(bytes.buffer);
        value += view2.getUint32(0, false) + 2048;
      } else if (ptr_size === 2) {
        // If the size is 2, the pointer is built by appending the next three bytes to the last three bits to produce a 27-bit value + 526336.
        const bytes = new Uint8Array(4);
        bytes[0] = ptr_value;
        bytes[1] = view.getUint8(position);
        bytes[2] = view.getUint8(position + 1);
        bytes[3] = view.getUint8(position + 2);
        const view2 = new DataView(bytes.buffer);
        value += view2.getUint32(0, false) + 526336;
      } else if (ptr_size === 3) {
        // Finally, if the size is 3, the pointer's value is contained in the next four bytes as a 32-bit value. In this case, the last three bits of the control byte are ignored.
        value += view.getUint32(position);
      }

      [, , value] = this.decode(value);
      return [type, position + ptr_size + 1, value];
    }

    if (size === 29) {
      // If the value is 29, then the size is 29 + the next byte after the type specifying bytes as an unsigned integer.
      size = 29 + view.getUint8(position);
      position += 1;
    } else if (size === 30) {
      // If the value is 30, then the size is 285 + the next two bytes after the type specifying bytes as a single unsigned integer.
      size = 285 + view.getUint16(position);
      position += 2;
    } else if (size === 31) {
      // If the value is 31, then the size is 65821 + the next three bytes after the type specifying bytes as a single unsigned integer.
      const bytes = new Uint8Array(4);
      bytes.set([
        0,
        view.getUint8(position),
        view.getUint8(position + 1),
        view.getUint8(position + 2),
      ]);
      const view2 = new DataView(bytes.buffer);
      size = 65821 + view2.getUint32(0, false);
      position += 3;
    }

    if (type === 2) {
      // UTF-8 string
      const value = new TextDecoder('utf-8').decode(
        new Uint8Array(this.buffer.slice(position, position + size)),
      );
      return [type, position + size, value];
    } else if (type === 3) {
      // double
      if (size !== 8) {
        throw new Error('Unsupported size of double');
      }
      const value = view.getFloat64(position, false);
      return [type, position + 8, value];
    } else if (type === 5) {
      // unsigned 16-bit int
      let value: number;
      if (size === 0) {
        value = 0;
      } else if (size === 1) {
        const bytes = new Uint8Array(2);
        bytes[1] = view.getUint8(position);
        const view2 = new DataView(bytes.buffer);
        value = view2.getUint16(0, false);
      } else if (size === 2) {
        value = view.getUint16(position, false);
      } else {
        throw new Error(`Unexpected size: ${size}`);
      }
      return [type, position + size, value];
    } else if (type === 6) {
      // unsigned 32-bit int
      let value: number;
      if (size === 0) {
        value = 0;
      } else if (size === 4) {
        value = view.getUint32(position, false);
      } else if (size > 4) {
        throw new Error(`Unexpected size: ${size}`);
      } else {
        const bytes = new Uint8Array(4);
        for (let i = 0; i < size; i++) {
          bytes[4 - size + i] = view.getUint8(position + i);
        }
        const view2 = new DataView(bytes.buffer);
        value = view2.getUint32(0, false);
      }
      return [type, position + size, value];
    } else if (type === 7) {
      // 111 - map
      const map: any = {};
      for (let i = 0; i < size; i++) {
        let key_type, key, value_type, value;
        [key_type, position, key] = this.decode(position);
        [value_type, position, value] = this.decode(position);
        map[key] = value;
      }
      return [type, position, map];
    } else if (type === 9) {
      // unsigned 64-bit int
      let value: number | bigint;
      if (size === 0) {
        value = 0;
      } else if (size === 8) {
        value = view.getBigUint64(position, false);
      } else if (size > 8) {
        throw new Error(`Unexpected size: ${size}`);
      } else {
        const bytes = new Uint8Array(8);
        for (let i = 0; i < size; i++) {
          bytes[8 - size + i] = view.getUint8(position + i);
        }
        const view2 = new DataView(bytes.buffer);
        value = view2.getBigUint64(0, false);
      }
      if (value <= Number.MAX_SAFE_INTEGER) {
        value = Number(value);
      }
      return [type, position + size, value];
    } else if (type === 11) {
      // array
      const array: Array<any> = [];
      for (let i = 0; i < size; i++) {
        let value_type, value;
        [value_type, position, value] = this.decode(position);
        array.push(value);
      }
      return [type, position, array];
    } else if (type === 14) {
      // boolean
      const value: boolean = size === 1;
      return [type, position, value];
    } else {
      throw new Error(`Unknown type: ${type}`);
    }
  }

  equal(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) {
      return false;
    }
    for (let i = 0; i < a.byteLength; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  packIP(ip: string): ArrayBuffer {
    if (ip.includes('.')) {
      // IPv4
      const segments = ip.split('.');
      if (segments.length !== 4) {
        throw new Error('Invalid IP');
      }
      const bytes = new Uint8Array(4);
      for (let i = 0; i < 4; i++) {
        const n = parseInt(segments[i], 10);
        if (n < 0 || n > 255 || isNaN(n) || n.toString() !== segments[i]) {
          throw new Error('Invalid IP');
        }
        bytes[i] = n;
      }
      return bytes.buffer;
    } else {
      // IPv6
      const segments = ip.split(':');
      if (segments.length > 8) {
        throw new Error('Invalid IP');
      }
      const bytes = new Uint8Array(16);
      for (let i = 0, j = 0; i < segments.length; i++, j++) {
        if (segments[i].length > 4) {
          throw new Error('Invalid IP');
        }
        if (segments[i] === '') {
          if (i === 0 || i === segments.length - 1) {
            continue;
          }
          j += 8 - segments.length;
          if (j > 8) {
            throw new Error('Invalid IP');
          }
          continue;
        }
        const n = parseInt(segments[i], 16);
        if (n < 0 || n > 65535 || isNaN(n)) {
          throw new Error('Invalid IP');
        }
        const hextet = new Uint16Array(1);
        hextet[0] = n;
        const view = new DataView(hextet.buffer);
        bytes[2 * j] = view.getUint8(1);
        bytes[2 * j + 1] = view.getUint8(0);
      }
      return bytes.buffer;
    }
  }

  private string2Uint8Array(s: string): Uint8Array {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      arr[i] = s.charCodeAt(i);
    }
    return arr;
  }
}
