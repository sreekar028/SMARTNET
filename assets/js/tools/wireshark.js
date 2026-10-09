/**
 * SMARTNET — wireshark.js
 * Member 7: Network Analysis Tools
 * Wireshark Packet Capture & Protocol Analysis Engine
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Wireshark = (function () {
  'use strict';

  // Internal state
  let allPackets = [];
  let filteredPackets = [];
  let selectedPacketIndex = null;
  let activeMode = 'demo';

  /* ═══════════════════════════════════════════════════════════
     1. PRE-LOADED DEMONSTRATION SCENARIOS (Mode C)
  ════════════════════════════════════════════════════════════ */
  const DEMO_SCENARIOS = {
    smartnet_traffic: [
      {
        num: 1, time: 0.000000, src: '192.168.1.10', dst: '192.168.1.1', proto: 'ARP', len: 42,
        info: 'Who has 192.168.1.1? Tell 192.168.1.10',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: 'ff:ff:ff:ff:ff:ff', type: '0x0806 (ARP)' },
          arp: { hwType: 'Ethernet (1)', protoType: 'IPv4 (0x0800)', opcode: 'Request (1)', senderMac: '00:1a:2b:3c:4d:01', senderIp: '192.168.1.10', targetMac: '00:00:00:00:00:00', targetIp: '192.168.1.1' }
        },
        payloadHex: 'ffffffffffff001a2b3c4d0108060001080006040001001a2b3c4d01c0a8010a000000000000c0a80101'
      },
      {
        num: 2, time: 0.000854, src: '192.168.1.1', dst: '192.168.1.10', proto: 'ARP', len: 42,
        info: '192.168.1.1 is at 00:50:56:c0:00:01',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0806 (ARP)' },
          arp: { hwType: 'Ethernet (1)', protoType: 'IPv4 (0x0800)', opcode: 'Reply (2)', senderMac: '00:50:56:c0:00:01', senderIp: '192.168.1.1', targetMac: '00:1a:2b:3c:4d:01', targetIp: '192.168.1.10' }
        },
        payloadHex: '001a2b3c4d01005056c0000108060001080006040002005056c00001c0a80101001a2b3c4d01c0a8010a'
      },
      {
        num: 3, time: 0.003120, src: '192.168.1.10', dst: '10.0.0.100', proto: 'DNS', len: 74,
        info: 'Standard query 0x1a2b A smartnet.corp',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '17 (UDP)', src: '192.168.1.10', dst: '10.0.0.100', len: 60 },
          udp: { srcPort: 54123, dstPort: 53, len: 40, check: '0x2a11' },
          dns: { id: '0x1a2b', qr: 'Query (0)', opcode: 'Standard Query (0)', qname: 'smartnet.corp', qtype: 'A (1)' }
        },
        payloadHex: '4500003c1a2b00004011e2fac0a8010a0a000064d36b003500282a111a2b0100000100000000000008736d6172746e657404636f72700000010001'
      },
      {
        num: 4, time: 0.005890, src: '10.0.0.100', dst: '192.168.1.10', proto: 'DNS', len: 90,
        info: 'Standard query response 0x1a2b A smartnet.corp A 10.0.0.100',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '17 (UDP)', src: '10.0.0.100', dst: '192.168.1.10', len: 76 },
          udp: { srcPort: 53, dstPort: 54123, len: 56, check: '0x4f88' },
          dns: { id: '0x1a2b', qr: 'Response (1)', answers: 1, respName: 'smartnet.corp', respIp: '10.0.0.100' }
        },
        payloadHex: '4500004c1a2c00003e11e4f80a000064c0a8010a0035d36b00384f881a2b8180000100010000000008736d6172746e657404636f72700000010001c00c000100010000012c00040a000064'
      },
      {
        num: 5, time: 0.010240, src: '192.168.1.10', dst: '10.0.0.100', proto: 'TCP', len: 66,
        info: '52430 → 80 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM=1',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '6 (TCP)', src: '192.168.1.10', dst: '10.0.0.100', len: 52 },
          tcp: { srcPort: 52430, dstPort: 80, seq: 0, ack: 0, flags: '[SYN]', win: 64240, mss: 1460 }
        },
        payloadHex: '45000034a101000040065be6c0a8010a0a000064ccce005000000000000000008002faf05c9f0000020405b40103030801010402'
      },
      {
        num: 6, time: 0.013510, src: '10.0.0.100', dst: '192.168.1.10', proto: 'TCP', len: 66,
        info: '80 → 52430 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0 MSS=1460',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '6 (TCP)', src: '10.0.0.100', dst: '192.168.1.10', len: 52 },
          tcp: { srcPort: 80, dstPort: 52430, seq: 0, ack: 1, flags: '[SYN, ACK]', win: 65160, mss: 1460 }
        },
        payloadHex: '45000034a10200003e065de50a000064c0a8010a0050ccce3f4e1d90000000018012fe882b410000020405b40103030801010402'
      },
      {
        num: 7, time: 0.013820, src: '192.168.1.10', dst: '10.0.0.100', proto: 'TCP', len: 54,
        info: '52430 → 80 [ACK] Seq=1 Ack=1 Win=64240 Len=0',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '6 (TCP)', src: '192.168.1.10', dst: '10.0.0.100', len: 40 },
          tcp: { srcPort: 52430, dstPort: 80, seq: 1, ack: 1, flags: '[ACK]', win: 64240 }
        },
        payloadHex: '45000028a103000040065bf1c0a8010a0a000064ccce0050000000013f4e1d915010faf0e14a0000'
      },
      {
        num: 8, time: 0.014200, src: '192.168.1.10', dst: '10.0.0.100', proto: 'HTTP', len: 218,
        info: 'GET /api/v1/topology HTTP/1.1 (Host: smartnet.corp)',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '6 (TCP)', src: '192.168.1.10', dst: '10.0.0.100', len: 204 },
          tcp: { srcPort: 52430, dstPort: 80, seq: 1, ack: 1, flags: '[PSH, ACK]', win: 64240, payloadLen: 164 },
          http: { method: 'GET', uri: '/api/v1/topology', version: 'HTTP/1.1', host: 'smartnet.corp', userAgent: 'SmartNet-Client/2.0' }
        },
        payloadHex: '474554202f6170692f76312f746f706f6c6f677920485454502f312e310d0a486f73743a20736d6172746e65742e636f72700d0a557365722d4167656e743a20536d6172744e65742d436c69656e742f322e300d0a4163636570743a202a2f2a0d0a0d0a'
      },
      {
        num: 9, time: 0.017840, src: '10.0.0.100', dst: '192.168.1.10', proto: 'TCP', len: 54,
        info: '80 → 52430 [ACK] Seq=1 Ack=165 Win=65000 Len=0',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '6 (TCP)', src: '10.0.0.100', dst: '192.168.1.10', len: 40 },
          tcp: { srcPort: 80, dstPort: 52430, seq: 1, ack: 165, flags: '[ACK]', win: 65000 }
        },
        payloadHex: '45000028a10400003e065df00a000064c0a8010a0050ccce3f4e1d91000000a55010fde8df850000'
      },
      {
        num: 10, time: 0.021500, src: '10.0.0.100', dst: '192.168.1.10', proto: 'HTTP', len: 486,
        info: 'HTTP/1.1 200 OK  (application/json)',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '6 (TCP)', src: '10.0.0.100', dst: '192.168.1.10', len: 472 },
          tcp: { srcPort: 80, dstPort: 52430, seq: 1, ack: 165, flags: '[PSH, ACK]', win: 65000, payloadLen: 432 },
          http: { status: '200 OK', contentType: 'application/json', server: 'SmartNet-Core/1.0', body: '{"status":"ok","nodes":["PC1","PC2","PC3","PC4","R1","R2","R3","Server"]}' }
        },
        payloadHex: '485454502f312e3120323030204f4b0d0a5365727665723a20536d6172744e65742d436f72652f312e300d0a436f6e74656e742d547970653a206170706c69636174696f6e2f6a736f6e0d0a436f6e74656e742d4c656e6774683a2037380d0a0d0a7b22737461747573223a226f6b222c226e6f646573223a5b22504331222c22504332222c22504333222c22504334222c225231222c225232222c225233222c22536572766572225d7d'
      },
      {
        num: 11, time: 0.022100, src: '192.168.1.10', dst: '10.0.0.100', proto: 'TCP', len: 54,
        info: '52430 → 80 [ACK] Seq=165 Ack=433 Win=63800 Len=0',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '6 (TCP)', src: '192.168.1.10', dst: '10.0.0.100', len: 40 },
          tcp: { srcPort: 52430, dstPort: 80, seq: 165, ack: 433, flags: '[ACK]', win: 63800 }
        },
        payloadHex: '45000028a105000040065beec0a8010a0a000064ccce0050000000a53f4e1f415010f938d8210000'
      },
      {
        num: 12, time: 0.045200, src: '192.168.1.10', dst: '10.0.0.100', proto: 'ICMP', len: 98,
        info: 'Echo (ping) request  id=0x0001, seq=1/256, ttl=64',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '1 (ICMP)', src: '192.168.1.10', dst: '10.0.0.100', len: 84 },
          icmp: { type: '8 (Echo request)', code: 0, id: '0x0001', seq: 1, check: '0x5c42' }
        },
        payloadHex: '45000054000100004001a243c0a8010a0a00006408005c42000100016578616d706c652070696e67207061796c6f616420646174612031323334353637383930'
      },
      {
        num: 13, time: 0.048100, src: '10.0.0.100', dst: '192.168.1.10', proto: 'ICMP', len: 98,
        info: 'Echo (ping) reply    id=0x0001, seq=1/256, ttl=62',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '1 (ICMP)', src: '10.0.0.100', dst: '192.168.1.10', len: 84 },
          icmp: { type: '0 (Echo reply)', code: 0, id: '0x0001', seq: 1, check: '0x6442' }
        },
        payloadHex: '45000054000200003e01a4420a000064c0a8010a00006442000100016578616d706c652070696e67207061796c6f616420646174612031323334353637383930'
      },
      {
        num: 14, time: 0.062000, src: '192.168.1.10', dst: '10.0.0.100', proto: 'TCP', len: 54,
        info: '52430 → 80 [FIN, ACK] Seq=165 Ack=433 Win=63800 Len=0',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:01', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '6 (TCP)', src: '192.168.1.10', dst: '10.0.0.100', len: 40 },
          tcp: { srcPort: 52430, dstPort: 80, seq: 165, ack: 433, flags: '[FIN, ACK]', win: 63800 }
        },
        payloadHex: '45000028a106000040065becc0a8010a0a000064ccce0050000000a53f4e1f415011f938d820000'
      },
      {
        num: 15, time: 0.064500, src: '10.0.0.100', dst: '192.168.1.10', proto: 'TCP', len: 54,
        info: '80 → 52430 [FIN, ACK] Seq=433 Ack=166 Win=65000 Len=0',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '6 (TCP)', src: '10.0.0.100', dst: '192.168.1.10', len: 40 },
          tcp: { srcPort: 80, dstPort: 52430, seq: 433, ack: 166, flags: '[FIN, ACK]', win: 65000 }
        },
        payloadHex: '45000028a10700003e065ded0a000064c0a8010a0050ccce3f4e1f41000000a65011fde8df840000'
      }
    ],

    syn_flood: (function () {
      const pkts = [];
      const victim = '10.0.0.100';
      const attackers = ['198.51.100.12', '203.0.113.45', '185.220.101.5', '45.142.122.8', '91.240.118.23'];
      let t = 0.00000;
      for (let i = 1; i <= 35; i++) {
        t += 0.00042 + Math.random() * 0.0002;
        const srcIp = attackers[i % attackers.length];
        const srcPort = 30000 + (i * 137) % 30000;
        pkts.push({
          num: i,
          time: parseFloat(t.toFixed(6)),
          src: srcIp,
          dst: victim,
          proto: 'TCP',
          len: 54,
          info: `${srcPort} → 80 [SYN] Seq=${i * 1000} Win=1024 Len=0 (Anomaly: SYN Flood)`,
          layers: {
            eth: { src: '00:11:22:33:44:55', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
            ip: { ver: 4, ihl: 20, ttl: 48, proto: '6 (TCP)', src: srcIp, dst: victim, len: 40 },
            tcp: { srcPort: srcPort, dstPort: 80, seq: i * 1000, ack: 0, flags: '[SYN]', win: 1024 }
          },
          payloadHex: '45000028' + (1000 + i).toString(16) + '00003006abcd' + srcIp.split('.').map(x=>parseInt(x).toString(16).padStart(2,'0')).join('') + '0a000064'
        });
      }
      return pkts;
    })(),

    network_diagnostics: [
      {
        num: 1, time: 0.000000, src: '192.168.1.20', dst: '192.168.1.1', proto: 'ARP', len: 42,
        info: 'Who has 192.168.1.1? Tell 192.168.1.20',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:02', dst: 'ff:ff:ff:ff:ff:ff', type: '0x0806 (ARP)' },
          arp: { opcode: 'Request (1)', senderIp: '192.168.1.20', targetIp: '192.168.1.1' }
        },
        payloadHex: 'ffffffffffff001a2b3c4d0208060001080006040001'
      },
      {
        num: 2, time: 0.001100, src: '192.168.1.1', dst: '192.168.1.20', proto: 'ARP', len: 42,
        info: '192.168.1.1 is at 00:50:56:c0:00:01',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:02', type: '0x0806 (ARP)' },
          arp: { opcode: 'Reply (2)', senderIp: '192.168.1.1', targetIp: '192.168.1.20' }
        },
        payloadHex: '001a2b3c4d02005056c0000108060001080006040002'
      },
      {
        num: 3, time: 0.004200, src: '192.168.1.20', dst: '10.0.0.100', proto: 'UDP', len: 60,
        info: '33434 → 33434 Len=18 (Traceroute Probe 1, TTL=1)',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:02', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 1, proto: '17 (UDP)', src: '192.168.1.20', dst: '10.0.0.100', len: 46 },
          udp: { srcPort: 33434, dstPort: 33434, len: 26 }
        },
        payloadHex: '4500002e000100000111'
      },
      {
        num: 4, time: 0.006800, src: '192.168.1.1', dst: '192.168.1.20', proto: 'ICMP', len: 70,
        info: 'Time-to-live exceeded (Time to live exceeded in transit)',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:02', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '1 (ICMP)', src: '192.168.1.1', dst: '192.168.1.20', len: 56 },
          icmp: { type: '11 (Time-to-live exceeded)', code: 0 }
        },
        payloadHex: '45000038000200004001'
      },
      {
        num: 5, time: 0.012500, src: '192.168.1.20', dst: '10.0.0.100', proto: 'ICMP', len: 84,
        info: 'Echo (ping) request  id=0x1234, seq=1/256, ttl=64',
        layers: {
          eth: { src: '00:1a:2b:3c:4d:02', dst: '00:50:56:c0:00:01', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 64, proto: '1 (ICMP)', src: '192.168.1.20', dst: '10.0.0.100', len: 70 },
          icmp: { type: '8 (Echo request)', code: 0, id: '0x1234', seq: 1 }
        },
        payloadHex: '45000046000300004001'
      },
      {
        num: 6, time: 0.015200, src: '10.0.0.100', dst: '192.168.1.20', proto: 'ICMP', len: 84,
        info: 'Echo (ping) reply    id=0x1234, seq=1/256, ttl=62',
        layers: {
          eth: { src: '00:50:56:c0:00:01', dst: '00:1a:2b:3c:4d:02', type: '0x0800 (IPv4)' },
          ip: { ver: 4, ihl: 20, ttl: 62, proto: '1 (ICMP)', src: '10.0.0.100', dst: '192.168.1.20', len: 70 },
          icmp: { type: '0 (Echo reply)', code: 0, id: '0x1234', seq: 1 }
        },
        payloadHex: '45000046000400003e01'
      }
    ]
  };

  /* ═══════════════════════════════════════════════════════════
     2. PARSING LOGIC: PCAP / JSON / TSHARK
  ════════════════════════════════════════════════════════════ */

  /**
   * Parse binary PCAP ArrayBuffer
   */
  function parseBinaryPcap(buffer) {
    const dataView = new DataView(buffer);
    if (buffer.byteLength < 24) {
      throw new Error('File too small to be a valid PCAP file (minimum 24 bytes required).');
    }

    const magic = dataView.getUint32(0, true);
    let littleEndian = true;

    if (magic === 0xa1b2c3d4) {
      littleEndian = false;
    } else if (magic === 0xd4c3b2a1) {
      littleEndian = true;
    } else if (magic === 0xa1b23c4d) {
      littleEndian = false; // nanosecond pcap
    } else if (magic === 0x4d3cb2a1) {
      littleEndian = true;
    } else if (magic === 0x0a0d0d0a) {
      throw new Error('PcapNG format detected. For best results in browser analysis, export to standard .pcap or use TShark -T json.');
    } else {
      throw new Error(`Unrecognized PCAP magic header: 0x${magic.toString(16)}. Ensure the file is a standard Libpcap capture.`);
    }

    const linkType = dataView.getUint32(20, littleEndian); // 1 = LINKTYPE_ETHERNET
    const parsed = [];
    let offset = 24;
    let packetNum = 1;
    let baseTime = null;

    while (offset + 16 <= buffer.byteLength) {
      const tsSec = dataView.getUint32(offset, littleEndian);
      const tsUsec = dataView.getUint32(offset + 4, littleEndian);
      const inclLen = dataView.getUint32(offset + 8, littleEndian);
      const origLen = dataView.getUint32(offset + 12, littleEndian);
      offset += 16;

      if (offset + inclLen > buffer.byteLength) {
        break; // truncated last packet
      }

      const rawBytes = new Uint8Array(buffer, offset, inclLen);
      const curTime = tsSec + tsUsec / 1000000;
      if (baseTime === null) baseTime = curTime;
      const relTime = parseFloat((curTime - baseTime).toFixed(6));

      // Dissect packet layers
      const dissection = dissectPacket(rawBytes, linkType);

      parsed.push({
        num: packetNum++,
        time: relTime,
        src: dissection.src,
        dst: dissection.dst,
        proto: dissection.proto,
        len: origLen || inclLen,
        info: dissection.info,
        layers: dissection.layers,
        payloadHex: bufferToHex(rawBytes)
      });

      offset += inclLen;
      if (packetNum > 1000) break; // safety guard for UI performance
    }

    if (parsed.length === 0) {
      throw new Error('Valid PCAP header found, but no packet records could be extracted.');
    }

    return parsed;
  }

  /**
   * Dissect Ethernet & IP packet layers
   */
  function dissectPacket(bytes, linkType) {
    let src = 'Unknown';
    let dst = 'Unknown';
    let proto = 'Unknown';
    let info = 'Raw packet frame';
    const layers = {};

    let cursor = 0;
    // Ethernet framing
    if (bytes.length >= 14) {
      const dstMac = macToStr(bytes, 0);
      const srcMac = macToStr(bytes, 6);
      const etherType = (bytes[12] << 8) | bytes[13];
      layers.eth = {
        dst: dstMac,
        src: srcMac,
        type: `0x${etherType.toString(16).padStart(4, '0')}`
      };
      cursor = 14;

      if (etherType === 0x0800 && bytes.length >= cursor + 20) {
        // IPv4
        const ihl = (bytes[cursor] & 0x0f) * 4;
        const totalLen = (bytes[cursor + 2] << 8) | bytes[cursor + 3];
        const ttl = bytes[cursor + 8];
        const ipProto = bytes[cursor + 9];
        const srcIp = `${bytes[cursor+12]}.${bytes[cursor+13]}.${bytes[cursor+14]}.${bytes[cursor+15]}`;
        const dstIp = `${bytes[cursor+16]}.${bytes[cursor+17]}.${bytes[cursor+18]}.${bytes[cursor+19]}`;

        src = srcIp;
        dst = dstIp;
        layers.ip = { ver: 4, ihl, ttl, proto: ipProto, src: srcIp, dst: dstIp, len: totalLen };
        cursor += ihl;

        if (ipProto === 6 && bytes.length >= cursor + 20) {
          // TCP
          proto = 'TCP';
          const srcPort = (bytes[cursor] << 8) | bytes[cursor + 1];
          const dstPort = (bytes[cursor + 2] << 8) | bytes[cursor + 3];
          const seq = ((bytes[cursor + 4] << 24) | (bytes[cursor + 5] << 16) | (bytes[cursor + 6] << 8) | bytes[cursor + 7]) >>> 0;
          const ack = ((bytes[cursor + 8] << 24) | (bytes[cursor + 9] << 16) | (bytes[cursor + 10] << 8) | bytes[cursor + 11]) >>> 0;
          const flagsByte = bytes[cursor + 13];
          const flags = [];
          if (flagsByte & 0x02) flags.push('SYN');
          if (flagsByte & 0x10) flags.push('ACK');
          if (flagsByte & 0x01) flags.push('FIN');
          if (flagsByte & 0x04) flags.push('RST');
          if (flagsByte & 0x08) flags.push('PSH');

          layers.tcp = { srcPort, dstPort, seq, ack, flags: `[${flags.join(', ')}]` };

          if (srcPort === 80 || dstPort === 80) proto = 'HTTP';
          info = `${srcPort} → ${dstPort} [${flags.join(', ')}] Seq=${seq} Ack=${ack}`;
        } else if (ipProto === 17 && bytes.length >= cursor + 8) {
          // UDP
          proto = 'UDP';
          const srcPort = (bytes[cursor] << 8) | bytes[cursor + 1];
          const dstPort = (bytes[cursor + 2] << 8) | bytes[cursor + 3];
          const uLen = (bytes[cursor + 4] << 8) | bytes[cursor + 5];
          layers.udp = { srcPort, dstPort, len: uLen };

          if (srcPort === 53 || dstPort === 53) proto = 'DNS';
          info = `${srcPort} → ${dstPort} Len=${uLen}`;
        } else if (ipProto === 1) {
          // ICMP
          proto = 'ICMP';
          const type = bytes[cursor];
          const code = bytes[cursor + 1];
          layers.icmp = { type, code };
          info = type === 8 ? 'Echo request (ping)' : type === 0 ? 'Echo reply (ping)' : `ICMP Type ${type}`;
        } else {
          proto = `IP (${ipProto})`;
          info = `Protocol ${ipProto} packet`;
        }
      } else if (etherType === 0x0806 && bytes.length >= cursor + 28) {
        // ARP
        proto = 'ARP';
        const opcode = (bytes[cursor + 6] << 8) | bytes[cursor + 7];
        const sIp = `${bytes[cursor+14]}.${bytes[cursor+15]}.${bytes[cursor+16]}.${bytes[cursor+17]}`;
        const tIp = `${bytes[cursor+24]}.${bytes[cursor+25]}.${bytes[cursor+26]}.${bytes[cursor+27]}`;
        src = sIp;
        dst = tIp;
        layers.arp = { opcode: opcode === 1 ? 'Request (1)' : 'Reply (2)', senderIp: sIp, targetIp: tIp };
        info = opcode === 1 ? `Who has ${tIp}? Tell ${sIp}` : `${sIp} is at ${macToStr(bytes, cursor + 8)}`;
      }
    }

    return { src, dst, proto, info, layers };
  }

  function macToStr(bytes, offset) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      parts.push(bytes[offset + i].toString(16).padStart(2, '0'));
    }
    return parts.join(':');
  }

  function bufferToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  /**
   * Parse TShark plain text or structured export
   */
  function parseTSharkText(text) {
    const lines = text.trim().split(/\r?\n/);
    const parsed = [];
    let count = 1;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Check if line is JSON
      if (line.startsWith('{')) {
        try {
          const obj = JSON.parse(line);
          parsed.push({
            num: count++,
            time: parseFloat(obj.time || obj._source?.layers?.frame?.['frame.time_relative'] || (count * 0.001)),
            src: obj.src || obj._source?.layers?.ip?.['ip.src'] || '192.168.1.1',
            dst: obj.dst || obj._source?.layers?.ip?.['ip.dst'] || '10.0.0.100',
            proto: (obj.proto || obj._source?.layers?.frame?.['frame.protocols'] || 'TCP').toUpperCase(),
            len: parseInt(obj.len || obj._source?.layers?.frame?.['frame.len'] || 64, 10),
            info: obj.info || 'TShark imported frame',
            layers: { eth: {}, ip: {} },
            payloadHex: ''
          });
          continue;
        } catch (e) {
          // fallback to text parse
        }
      }

      // Format typical: "  1   0.000000 192.168.1.10 -> 10.0.0.100  TCP 66 52430 > 80 [SYN] ..."
      const parts = line.split(/\s+/);
      if (parts.length >= 6) {
        let num = parseInt(parts[0], 10) || count++;
        let time = parseFloat(parts[1]) || 0.0;
        let src = parts[2].replace('->', '');
        let dst = parts[3] === '->' ? parts[4] : parts[3];
        let protoIndex = parts[3] === '->' ? 5 : 4;
        let proto = (parts[protoIndex] || 'TCP').toUpperCase();
        let len = parseInt(parts[protoIndex + 1], 10) || 64;
        let info = parts.slice(protoIndex + 2).join(' ') || line;

        parsed.push({
          num, time, src, dst, proto, len, info,
          layers: {
            eth: { type: '0x0800' },
            ip: { src, dst }
          },
          payloadHex: ''
        });
      }
    }

    if (parsed.length === 0) {
      throw new Error('Could not parse TShark output. Expected summary columns: [No.] [Time] [Source] [->] [Destination] [Protocol] [Length] [Info]');
    }

    return parsed;
  }

  /* ═══════════════════════════════════════════════════════════
     3. UI RENDERING & EVENT HANDLING
  ═══════════════════════════════════════════════════════════ */

  function loadScenario(scenarioKey) {
    const data = DEMO_SCENARIOS[scenarioKey];
    if (!data) return;

    allPackets = JSON.parse(JSON.stringify(data));
    filteredPackets = [...allPackets];
    selectedPacketIndex = 0;

    applyFilter();
    updateUI();
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = function (e) {
        try {
          const json = JSON.parse(e.target.result);
          if (Array.isArray(json)) {
            allPackets = json;
          } else if (json._source) {
            allPackets = [json];
          } else {
            throw new Error('JSON capture file must be an array of packet records.');
          }
          filteredPackets = [...allPackets];
          selectedPacketIndex = 0;
          applyFilter();
          updateUI();
        } catch (err) {
          alert('Error parsing JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      // Binary PCAP or raw text
      reader.onload = function (e) {
        try {
          const buffer = e.target.result;
          allPackets = parseBinaryPcap(buffer);
          filteredPackets = [...allPackets];
          selectedPacketIndex = 0;
          applyFilter();
          updateUI();
        } catch (err) {
          alert('PCAP Parse Warning: ' + err.message + '\n\nTry uploading standard .pcap libpcap file or use Mode B (TShark text import).');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function handleTSharkImport() {
    const input = document.getElementById('ws-tshark-input');
    const text = input ? input.value : '';
    if (!text.trim()) {
      alert('Please paste TShark summary lines or JSON records.');
      return;
    }

    try {
      allPackets = parseTSharkText(text);
      filteredPackets = [...allPackets];
      selectedPacketIndex = 0;
      applyFilter();
      updateUI();
    } catch (err) {
      alert('TShark Import Failed: ' + err.message);
    }
  }

  function applyFilter() {
    const exprInput = document.getElementById('ws-filter-expr');
    const protoSelect = document.getElementById('ws-filter-proto');

    const expr = (exprInput ? exprInput.value : '').trim().toLowerCase();
    const protoFilter = (protoSelect ? protoSelect.value : '').toUpperCase();

    filteredPackets = allPackets.filter(p => {
      // Protocol dropdown filter
      if (protoFilter && p.proto !== protoFilter) {
        return false;
      }

      // Expression filter
      if (expr) {
        if (expr === 'tcp' && p.proto !== 'TCP' && p.proto !== 'HTTP') return false;
        if (expr === 'udp' && p.proto !== 'UDP' && p.proto !== 'DNS') return false;
        if (expr === 'http' && p.proto !== 'HTTP') return false;
        if (expr === 'dns' && p.proto !== 'DNS') return false;
        if (expr === 'icmp' && p.proto !== 'ICMP') return false;
        if (expr === 'arp' && p.proto !== 'ARP') return false;

        if (expr.includes('ip.src ==')) {
          const matchIp = expr.split('==')[1].trim();
          if (p.src !== matchIp) return false;
        } else if (expr.includes('ip.dst ==')) {
          const matchIp = expr.split('==')[1].trim();
          if (p.dst !== matchIp) return false;
        } else if (!['tcp', 'udp', 'http', 'dns', 'icmp', 'arp'].includes(expr)) {
          // Text search across all fields
          const line = `${p.num} ${p.src} ${p.dst} ${p.proto} ${p.info}`.toLowerCase();
          if (!line.includes(expr)) return false;
        }
      }

      return true;
    });

    if (filteredPackets.length > 0) {
      selectedPacketIndex = 0;
    } else {
      selectedPacketIndex = null;
    }
  }

  function updateUI() {
    renderSummaryStats();
    renderPacketTable();
    renderCharts();
    renderTopTalkers();
    renderSelectedPacketDetails();
  }

  function renderSummaryStats() {
    const totalPktEl = document.getElementById('stat-total-packets');
    const visPktEl = document.getElementById('stat-visible-packets');
    const totalBytesEl = document.getElementById('stat-total-bytes');
    const avgSizeEl = document.getElementById('stat-avg-size');
    const durEl = document.getElementById('stat-duration');
    const rateEl = document.getElementById('stat-rate');
    const tcpCountEl = document.getElementById('stat-tcp-count');
    const tcpPctEl = document.getElementById('stat-tcp-pct');
    const udpCountEl = document.getElementById('stat-udp-count');
    const udpPctEl = document.getElementById('stat-udp-pct');
    const othCountEl = document.getElementById('stat-other-count');
    const othPctEl = document.getElementById('stat-other-pct');
    const countFilEl = document.getElementById('count-filtered');
    const countTotEl = document.getElementById('count-total');

    const total = allPackets.length;
    const filtered = filteredPackets.length;
    if (countTotEl) countTotEl.textContent = total;
    if (countFilEl) countFilEl.textContent = filtered;
    if (totalPktEl) totalPktEl.textContent = total;
    if (visPktEl) visPktEl.textContent = `Showing ${filtered}`;

    let totalBytes = 0;
    let tcpCount = 0;
    let udpCount = 0;
    let minTime = Infinity;
    let maxTime = 0;

    allPackets.forEach(p => {
      totalBytes += p.len || 0;
      if (p.proto === 'TCP' || p.proto === 'HTTP') tcpCount++;
      else if (p.proto === 'UDP' || p.proto === 'DNS') udpCount++;
      if (p.time < minTime) minTime = p.time;
      if (p.time > maxTime) maxTime = p.time;
    });

    const otherCount = total - (tcpCount + udpCount);
    const duration = total > 1 && maxTime >= minTime ? (maxTime - minTime) : 0.01;
    const rate = duration > 0 ? (total / duration).toFixed(1) : total;

    if (totalBytesEl) totalBytesEl.textContent = formatBytes(totalBytes);
    if (avgSizeEl) avgSizeEl.textContent = `Avg: ${total > 0 ? Math.round(totalBytes / total) : 0} B`;
    if (durEl) durEl.textContent = `${duration.toFixed(3)} s`;
    if (rateEl) rateEl.textContent = `Rate: ${rate} pkt/s`;

    if (tcpCountEl) tcpCountEl.textContent = tcpCount;
    if (tcpPctEl) tcpPctEl.textContent = total > 0 ? `${Math.round((tcpCount / total) * 100)}%` : '0%';
    if (udpCountEl) udpCountEl.textContent = udpCount;
    if (udpPctEl) udpPctEl.textContent = total > 0 ? `${Math.round((udpCount / total) * 100)}%` : '0%';
    if (othCountEl) othCountEl.textContent = otherCount;
    if (othPctEl) othPctEl.textContent = total > 0 ? `${Math.round((otherCount / total) * 100)}%` : '0%';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function getProtoBadge(proto) {
    const p = (proto || '').toUpperCase();
    let cls = 'proto-other';
    if (p === 'TCP') cls = 'proto-tcp';
    else if (p === 'UDP') cls = 'proto-udp';
    else if (p === 'HTTP') cls = 'proto-http';
    else if (p === 'DNS') cls = 'proto-dns';
    else if (p === 'ICMP') cls = 'proto-icmp';
    else if (p === 'ARP') cls = 'proto-arp';

    return `<span class="badge-proto ${cls}">${p}</span>`;
  }

  function renderPacketTable() {
    const tbody = document.getElementById('ws-packet-rows');
    if (!tbody) return;

    if (filteredPackets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No matching packets found for active filter.</td></tr>`;
      return;
    }

    let html = '';
    filteredPackets.forEach((p, idx) => {
      const isSelected = idx === selectedPacketIndex ? 'selected-packet' : '';
      html += `
        <tr class="${isSelected}" onclick="SMARTNET.Wireshark.selectPacket(${idx})">
          <td>${p.num}</td>
          <td>${p.time.toFixed(6)}</td>
          <td>${escapeHtml(p.src)}</td>
          <td>${escapeHtml(p.dst)}</td>
          <td>${getProtoBadge(p.proto)}</td>
          <td>${p.len}</td>
          <td class="text-truncate" style="max-width:320px;" title="${escapeHtml(p.info)}">${escapeHtml(p.info)}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function selectPacket(index) {
    selectedPacketIndex = index;
    renderPacketTable();
    renderSelectedPacketDetails();
  }

  function renderSelectedPacketDetails() {
    const treeEl = document.getElementById('packet-tree-view');
    const hexEl = document.getElementById('packet-hex-view');
    const badgeEl = document.getElementById('tree-selected-badge');
    const hexBadgeEl = document.getElementById('hex-len-badge');

    if (selectedPacketIndex === null || !filteredPackets[selectedPacketIndex]) {
      if (treeEl) treeEl.innerHTML = '<div class="text-muted text-center py-5">No packet selected.</div>';
      if (hexEl) hexEl.innerHTML = '0000  -- No packet selected --';
      if (badgeEl) badgeEl.textContent = 'No Packet Selected';
      if (hexBadgeEl) hexBadgeEl.textContent = '0 bytes';
      return;
    }

    const pkt = filteredPackets[selectedPacketIndex];
    if (badgeEl) badgeEl.textContent = `Packet #${pkt.num} (${pkt.proto})`;
    if (hexBadgeEl) hexBadgeEl.textContent = `${pkt.len} bytes`;

    // Render Protocol Tree
    let treeHtml = '';

    // Frame layer
    treeHtml += `
      <div class="tree-node">
        <div class="tree-header">▼ Frame ${pkt.num}: ${pkt.len} bytes on wire</div>
        <div class="tree-body">
          <div class="tree-item">Arrival Time: ${pkt.time.toFixed(6)} seconds</div>
          <div class="tree-item">Frame Number: ${pkt.num}</div>
          <div class="tree-item">Frame Length: ${pkt.len} bytes (${pkt.len * 8} bits)</div>
        </div>
      </div>
    `;

    // Ethernet II
    if (pkt.layers?.eth) {
      const eth = pkt.layers.eth;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Ethernet II, Src: ${eth.src || '00:1a:2b:3c:4d:01'}, Dst: ${eth.dst || '00:50:56:c0:00:01'}</div>
          <div class="tree-body">
            <div class="tree-item">Destination MAC: ${eth.dst || '00:50:56:c0:00:01'}</div>
            <div class="tree-item">Source MAC: ${eth.src || '00:1a:2b:3c:4d:01'}</div>
            <div class="tree-item">Type: ${eth.type || 'IPv4 (0x0800)'}</div>
          </div>
        </div>
      `;
    }

    // IP layer
    if (pkt.layers?.ip) {
      const ip = pkt.layers.ip;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Internet Protocol Version 4, Src: ${ip.src}, Dst: ${ip.dst}</div>
          <div class="tree-body">
            <div class="tree-item">Version: 4</div>
            <div class="tree-item">Header Length: ${ip.ihl || 20} bytes</div>
            <div class="tree-item">Total Length: ${ip.len || pkt.len} bytes</div>
            <div class="tree-item">Time to Live: ${ip.ttl || 64} hops</div>
            <div class="tree-item">Protocol: ${ip.proto || pkt.proto}</div>
            <div class="tree-item">Source Address: ${ip.src}</div>
            <div class="tree-item">Destination Address: ${ip.dst}</div>
          </div>
        </div>
      `;
    }

    // ARP
    if (pkt.layers?.arp) {
      const arp = pkt.layers.arp;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Address Resolution Protocol (${arp.opcode || 'Request'})</div>
          <div class="tree-body">
            <div class="tree-item">Hardware type: Ethernet (1)</div>
            <div class="tree-item">Protocol type: IPv4 (0x0800)</div>
            <div class="tree-item">Opcode: ${arp.opcode || '1'}</div>
            <div class="tree-item">Sender IP: ${arp.senderIp}</div>
            <div class="tree-item">Target IP: ${arp.targetIp}</div>
          </div>
        </div>
      `;
    }

    // TCP
    if (pkt.layers?.tcp) {
      const tcp = pkt.layers.tcp;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Transmission Control Protocol, Src Port: ${tcp.srcPort}, Dst Port: ${tcp.dstPort}</div>
          <div class="tree-body">
            <div class="tree-item">Source Port: ${tcp.srcPort}</div>
            <div class="tree-item">Destination Port: ${tcp.dstPort}</div>
            <div class="tree-item">Sequence Number: ${tcp.seq}</div>
            <div class="tree-item">Acknowledgment Number: ${tcp.ack}</div>
            <div class="tree-item">Flags: ${tcp.flags || '[ACK]'}</div>
            <div class="tree-item">Window Size: ${tcp.win || 64240}</div>
          </div>
        </div>
      `;
    }

    // UDP
    if (pkt.layers?.udp) {
      const udp = pkt.layers.udp;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ User Datagram Protocol, Src Port: ${udp.srcPort}, Dst Port: ${udp.dstPort}</div>
          <div class="tree-body">
            <div class="tree-item">Source Port: ${udp.srcPort}</div>
            <div class="tree-item">Destination Port: ${udp.dstPort}</div>
            <div class="tree-item">Length: ${udp.len || pkt.len}</div>
          </div>
        </div>
      `;
    }

    // ICMP
    if (pkt.layers?.icmp) {
      const icmp = pkt.layers.icmp;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Internet Control Message Protocol</div>
          <div class="tree-body">
            <div class="tree-item">Type: ${icmp.type}</div>
            <div class="tree-item">Code: ${icmp.code !== undefined ? icmp.code : 0}</div>
          </div>
        </div>
      `;
    }

    // HTTP / DNS
    if (pkt.layers?.http) {
      const http = pkt.layers.http;
      treeHtml += `
        <div class="tree-node">
          <div class="tree-header">▼ Hypertext Transfer Protocol</div>
          <div class="tree-body">
            ${http.method ? `<div class="tree-item">Request Method: ${http.method}</div>` : ''}
            ${http.uri ? `<div class="tree-item">Request URI: ${http.uri}</div>` : ''}
            ${http.status ? `<div class="tree-item">Response Status: ${http.status}</div>` : ''}
            ${http.contentType ? `<div class="tree-item">Content-Type: ${http.contentType}</div>` : ''}
          </div>
        </div>
      `;
    }

    if (treeEl) treeEl.innerHTML = treeHtml;

    // Render Hex Dump
    renderHexDump(pkt);
  }

  function renderHexDump(pkt) {
    const hexEl = document.getElementById('packet-hex-view');
    if (!hexEl) return;

    let hexStr = pkt.payloadHex || '';
    if (!hexStr || hexStr.length === 0) {
      // synthesize dummy hex bytes if not present
      let synth = '';
      for (let i = 0; i < (pkt.len || 64); i++) {
        synth += ((i * 7 + 13) % 256).toString(16).padStart(2, '0');
      }
      hexStr = synth;
    }

    let output = '';
    const bytes = [];
    for (let i = 0; i < hexStr.length; i += 2) {
      bytes.push(parseInt(hexStr.substring(i, i + 2), 16) || 0);
    }

    for (let offset = 0; offset < bytes.length; offset += 16) {
      const rowOffset = offset.toString(16).padStart(4, '0');
      let rowHex = '';
      let rowAscii = '';

      for (let j = 0; j < 16; j++) {
        if (offset + j < bytes.length) {
          const b = bytes[offset + j];
          rowHex += b.toString(16).padStart(2, '0') + ' ';
          rowAscii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        } else {
          rowHex += '   ';
        }
        if (j === 7) rowHex += ' ';
      }

      output += `<span class="hex-offset">${rowOffset}</span>  <span class="hex-bytes">${rowHex}</span> <span class="hex-ascii">|${escapeHtml(rowAscii)}|</span>\n`;
    }

    hexEl.innerHTML = output;
  }

  /* ═══════════════════════════════════════════════════════════
     4. CHARTS: PROTOCOL BREAKDOWN & TIMELINE
  ═══════════════════════════════════════════════════════════ */

  function renderCharts() {
    renderProtoChart();
    renderTimelineChart();
  }

  function renderProtoChart() {
    const canvas = document.getElementById('canvas-proto-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const counts = {};
    allPackets.forEach(p => {
      const pr = p.proto || 'Other';
      counts[pr] = (counts[pr] || 0) + 1;
    });

    const colors = {
      TCP: '#70a1ff',
      UDP: '#4bc0c0',
      HTTP: '#06d6a0',
      DNS: '#fbbf24',
      ICMP: '#f87171',
      ARP: '#c084fc',
      Other: '#94a3b8'
    };

    const keys = Object.keys(counts);
    if (keys.length === 0) return;

    // Draw horizontal bar distribution
    const barY = 40;
    const barH = 34;
    const padding = 20;
    const total = allPackets.length;
    let curX = padding;
    const barWidth = w - padding * 2;

    keys.forEach(k => {
      const segW = (counts[k] / total) * barWidth;
      ctx.fillStyle = colors[k] || '#64748b';
      ctx.fillRect(curX, barY, segW, barH);
      curX += segW;
    });

    // Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, barY, barWidth, barH);

    // Legend
    const legendEl = document.getElementById('chart-proto-legend');
    if (legendEl) {
      let lHtml = '';
      keys.forEach(k => {
        const pct = Math.round((counts[k] / total) * 100);
        lHtml += `
          <div class="d-flex align-items-center gap-1 small">
            <span style="display:inline-block;width:12px;height:12px;background:${colors[k] || '#64748b'};border-radius:2px;"></span>
            <span class="fw-bold">${k}:</span>
            <span class="text-muted">${counts[k]} (${pct}%)</span>
          </div>
        `;
      });
      legendEl.innerHTML = lHtml;
    }
  }

  function renderTimelineChart() {
    const canvas = document.getElementById('canvas-timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (allPackets.length < 2) return;

    const maxTime = Math.max(...allPackets.map(p => p.time));
    const bins = 15;
    const binSize = maxTime > 0 ? maxTime / bins : 1;
    const hist = new Array(bins).fill(0);

    allPackets.forEach(p => {
      let idx = Math.floor(p.time / binSize);
      if (idx >= bins) idx = bins - 1;
      hist[idx]++;
    });

    const maxCount = Math.max(...hist, 1);
    const padX = 20;
    const padY = 20;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;
    const binWidth = chartW / bins;

    // Draw baseline
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(padX, h - padY);
    ctx.lineTo(w - padX, h - padY);
    ctx.stroke();

    // Draw bars
    hist.forEach((count, i) => {
      const bh = (count / maxCount) * (chartH - 10);
      const bx = padX + i * binWidth + 2;
      const by = h - padY - bh;
      const bw = binWidth - 4;

      ctx.fillStyle = 'rgba(79, 142, 247, 0.65)';
      ctx.fillRect(bx, by, bw, bh);

      // Top value text
      if (count > 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(count.toString(), bx + bw / 2, by - 4);
      }
    });
  }

  function renderTopTalkers() {
    const srcTbody = document.getElementById('table-top-sources');
    const dstTbody = document.getElementById('table-top-destinations');

    const srcMap = {};
    const dstMap = {};

    allPackets.forEach(p => {
      if (!srcMap[p.src]) srcMap[p.src] = { count: 0, bytes: 0 };
      srcMap[p.src].count++;
      srcMap[p.src].bytes += p.len || 0;

      if (!dstMap[p.dst]) dstMap[p.dst] = { count: 0, bytes: 0 };
      dstMap[p.dst].count++;
      dstMap[p.dst].bytes += p.len || 0;
    });

    const topSrc = Object.entries(srcMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    const topDst = Object.entries(dstMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

    if (srcTbody) {
      srcTbody.innerHTML = topSrc.map(([ip, data]) => `
        <tr>
          <td>${escapeHtml(ip)}</td>
          <td class="text-end fw-bold">${data.count}</td>
          <td class="text-end text-muted">${formatBytes(data.bytes)}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" class="text-muted text-center py-2">No data</td></tr>';
    }

    if (dstTbody) {
      dstTbody.innerHTML = topDst.map(([ip, data]) => `
        <tr>
          <td>${escapeHtml(ip)}</td>
          <td class="text-end fw-bold">${data.count}</td>
          <td class="text-end text-muted">${formatBytes(data.bytes)}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" class="text-muted text-center py-2">No data</td></tr>';
    }
  }

  /* ═══════════════════════════════════════════════════════════
     5. SAVE RESULTS & INTEGRATION
  ═══════════════════════════════════════════════════════════ */

  function saveResults() {
    if (allPackets.length === 0) {
      alert('No packets available to record in Results Center.');
      return;
    }

    const protoBreakdown = {};
    allPackets.forEach(p => {
      protoBreakdown[p.proto] = (protoBreakdown[p.proto] || 0) + 1;
    });

    let totalBytes = allPackets.reduce((acc, p) => acc + (p.len || 0), 0);

    const resultRecord = {
      module: 'wireshark',
      title: 'Wireshark Packet Analysis',
      timestamp: new Date().toISOString(),
      parameters: {
        mode: activeMode,
        totalPackets: allPackets.length,
        filteredPackets: filteredPackets.length,
        protocols: Object.keys(protoBreakdown)
      },
      metrics: {
        totalPackets: allPackets.length,
        totalBytes: totalBytes,
        avgPacketSize: Math.round(totalBytes / allPackets.length),
        protocolCounts: protoBreakdown
      },
      status: 'Completed',
      notes: `Successfully analyzed ${allPackets.length} packets across ${Object.keys(protoBreakdown).length} protocols.`
    };

    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.saveResult === 'function') {
      window.SMARTNET.Integration.saveResult(resultRecord);
      alert('Wireshark analysis report successfully saved to SMARTNET Results Center!');
    } else {
      alert('Analysis completed. (Local session saved)');
    }
  }

  function resetAll() {
    allPackets = [];
    filteredPackets = [];
    selectedPacketIndex = null;
    const filterInput = document.getElementById('ws-filter-expr');
    if (filterInput) filterInput.value = '';
    const filterProto = document.getElementById('ws-filter-proto');
    if (filterProto) filterProto.value = '';
    updateUI();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ═══════════════════════════════════════════════════════════
     6. INITIALIZATION
  ═══════════════════════════════════════════════════════════ */

  function init() {
    // Shared navigation
    if (window.SMARTNET && window.SMARTNET.Navigation && typeof window.SMARTNET.Navigation.init === 'function') {
      window.SMARTNET.Navigation.init('sn-nav-container');
    }
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.init === 'function') {
      window.SMARTNET.Integration.init();
    }

    // Mode selection change
    const modeSelect = document.getElementById('ws-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', function (e) {
        activeMode = e.target.value;
        document.getElementById('panel-mode-demo')?.classList.toggle('d-none', activeMode !== 'demo');
        document.getElementById('panel-mode-upload')?.classList.toggle('d-none', activeMode !== 'upload');
        document.getElementById('panel-mode-tshark')?.classList.toggle('d-none', activeMode !== 'tshark');
      });
    }

    // Button bindings
    document.getElementById('btn-load-demo')?.addEventListener('click', function () {
      const scenario = document.getElementById('ws-demo-scenario')?.value || 'smartnet_traffic';
      loadScenario(scenario);
    });

    document.getElementById('ws-file-input')?.addEventListener('change', handleFileUpload);
    document.getElementById('btn-parse-tshark')?.addEventListener('click', handleTSharkImport);

    document.getElementById('btn-apply-filter')?.addEventListener('click', function () {
      applyFilter();
      updateUI();
    });

    document.getElementById('btn-clear-filter')?.addEventListener('click', function () {
      const fin = document.getElementById('ws-filter-expr');
      const fpr = document.getElementById('ws-filter-proto');
      if (fin) fin.value = '';
      if (fpr) fpr.value = '';
      applyFilter();
      updateUI();
    });

    document.getElementById('btn-reset-ws')?.addEventListener('click', resetAll);
    document.getElementById('btn-save-results')?.addEventListener('click', saveResults);

    // Initial load: SmartNet scenario
    loadScenario('smartnet_traffic');
  }

  // Public Interface
  return {
    init,
    selectPacket,
    loadScenario,
    saveResults,
    resetAll
  };
})();

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  SMARTNET.Wireshark.init();
});
