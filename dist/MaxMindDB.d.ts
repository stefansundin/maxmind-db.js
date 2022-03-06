export default class MaxMindDB {
    private buffer;
    private search_tree_size;
    private data_section_start;
    private ipv4_start;
    private _metadata;
    loadBlob(blob: Blob): Promise<void>;
    get metadata(): any;
    get(ip: string): Array<any>;
    record(addr: ArrayBuffer): Array<any>;
    resolve_data_pointer(pointer: number): Array<any>;
    find_address_in_tree(addr: ArrayBuffer): Array<number>;
    start_node(addr_length: number): number;
    read_node(node_number: number, index: number): number;
    decode(position: number): Array<any>;
    equal(a: Uint8Array, b: Uint8Array): boolean;
    packIP(ip: string): ArrayBuffer;
    private string2Uint8Array;
}
//# sourceMappingURL=MaxMindDB.d.ts.map