const commandsToTry = new Map([
    // --- Star Micronics Specific Commands ---
    // Star打印机通常也兼容ESC/POS，但这些是其特定的或常用的命令
    // 适用于 Star TSP系列 (如 TSP100, TSP650), mPOP 等
    ['STAR_ESC_p_m0_t25_t250', [0x1B, 0x70, 0, 25, 250]], // Star: m=0 (钱箱1, 针脚2), 50ms ON, 500ms OFF (常见)
    ['STAR_ESC_p_m1_t25_t250', [0x1B, 0x70, 1, 25, 250]], // Star: m=1 (钱箱2, 针脚5), 50ms ON, 500ms OFF
    ['STAR_GS_a_1', [0x1B, 0x1D, 0x61, 1]],    // Star: 特定命令 - 钱箱1
    ['STAR_GS_a_2', [0x1B, 0x1D, 0x61, 2]],    // Star: 特定命令 - 钱箱2 (如果支持)
    ['STAR_BEL', [0x07]],                   // Star: BEL 字符 (常用于打开钱箱1)
    ['STAR_BEL_COMPLEX', [0x1B, 0x07, 0x07, 0x0F]], // Star: 更复杂的 BEL 序列 (某些驱动中可见, 钱箱1)

    // --- Epson & General ESC/POS Commands ---
    // 这些命令广泛适用于 Epson (TM系列如 TM-T88, TM-T82II, TM-U220),
    // Bixolon (SRP系列), Citizen (CT-S系列), Xprinter, Rongta, SPRT, Gainscha, HPRT 等兼容ESC/POS的打印机
    // 标准 ESC p m t1 t2 (m=0 对应钱箱1/针脚2, m=1 对应钱箱2/针脚5)
    // t1 = ON 时间 (单位: 2ms), t2 = OFF 时间 (单位: 2ms)

    // 钱箱1 (m=0 或 ASCII '0', 通常连接到打印机的 DK 端口的针脚 2 和 4) 的常见脉冲
    ['EPSON_ESC_p_m0_t1_t1', [0x1B, 0x70, 0, 1, 1]],    // Epson "最小" 脉冲 (钱箱1, ON 2ms, OFF 2ms) - 通常太短
    ['EPSON_ESC_p_m0_t2_t2', [0x1B, 0x70, 0, 2, 2]],    // 钱箱1, ON 4ms, OFF 4ms
    ['EPSON_ESC_p_m0_t5_t5', [0x1B, 0x70, 0, 5, 5]],    // 钱箱1, ON 10ms, OFF 10ms
    ['EPSON_ESC_p_m0_t5_t50', [0x1B, 0x70, 0, 5, 50]],   // 钱箱1, ON 10ms, OFF 100ms (短脉冲)
    ['EPSON_ESC_p_m0_t10_t10', [0x1B, 0x70, 0, 10, 10]],  // 钱箱1, ON 20ms, OFF 20ms (非常短)
    ['EPSON_ESC_p_m0_t10_t50', [0x1B, 0x70, 0, 10, 50]],  // 钱箱1, ON 20ms, OFF 100ms
    ['EPSON_ESC_p_m0_t12_t120', [0x1B, 0x70, 0, 12, 120]], // 钱箱1, ON 24ms, OFF 240ms
    ['EPSON_ESC_p_m0_t15_t15', [0x1B, 0x70, 0, 15, 15]],  // 钱箱1, ON 30ms, OFF 30ms
    ['EPSON_ESC_p_m0_t20_t40', [0x1B, 0x70, 0, 20, 40]],  // 钱箱1, ON 40ms, OFF 80ms
    ['EPSON_ESC_p_m0_t20_t100', [0x1B, 0x70, 0, 20, 100]], // 钱箱1, ON 40ms, OFF 200ms
    ['EPSON_ESC_p_m0_t25_t25', [0x1B, 0x70, 0, 25, 25]],  // 钱箱1, ON 50ms, OFF 50ms
    ['EPSON_ESC_p_m0_t25_t100', [0x1B, 0x70, 0, 25, 100]], // 钱箱1, ON 50ms, OFF 200ms
    ['EPSON_ESC_p_m0_t25_t250_COMMON', [0x1B, 0x70, 0, 25, 250]], // 钱箱1, ON 50ms, OFF 500ms (非常常见, 适用于多种Epson, Bixolon等)
    ['EPSON_ESC_p_m0_t30_t150', [0x1B, 0x70, 0, 30, 150]], // 钱箱1, ON 60ms, OFF 300ms
    ['EPSON_ESC_p_m0_t30_t250', [0x1B, 0x70, 0, 30, 250]], // 钱箱1, ON 60ms, OFF 500ms
    ['EPSON_ESC_p_m0_t40_t200', [0x1B, 0x70, 0, 40, 200]], // 钱箱1, ON 80ms, OFF 400ms
    ['EPSON_ESC_p_m0_t40_t250', [0x1B, 0x70, 0, 40, 250]], // 钱箱1, ON 80ms, OFF 500ms
    ['EPSON_ESC_p_m0_t50_t50', [0x1B, 0x70, 0, 50, 50]],  // 钱箱1, ON 100ms, OFF 100ms
    ['EPSON_ESC_p_m0_t50_t100', [0x1B, 0x70, 0, 50, 100]], // 钱箱1, ON 100ms, OFF 200ms
    ['EPSON_ESC_p_m0_t50_t150', [0x1B, 0x70, 0, 50, 150]], // 钱箱1, ON 100ms, OFF 300ms
    ['EPSON_ESC_p_m0_t50_t250', [0x1B, 0x70, 0, 50, 250]], // 钱箱1, ON 100ms, OFF 500ms
    ['EPSON_ESC_p_m0_t60_t250_DEFAULT', [0x1B, 0x70, 0, 60, 250]], // 钱箱1, ON 120ms, OFF 500ms (常被引用的Epson默认值, 如TM-T88系列, TM-T82II)
    ['EPSON_ESC_p_m0_t75_t250', [0x1B, 0x70, 0, 75, 250]], // 钱箱1, ON 150ms, OFF 500ms
    ['EPSON_ESC_p_m0_t80_t160', [0x1B, 0x70, 0, 80, 160]], // 钱箱1, ON 160ms, OFF 320ms
    ['EPSON_ESC_p_m0_t80_t250', [0x1B, 0x70, 0, 80, 250]], // 钱箱1, ON 160ms, OFF 500ms
    ['EPSON_ESC_p_m0_t100_t100', [0x1B, 0x70, 0, 100, 100]],// 钱箱1, ON 200ms, OFF 200ms
    ['EPSON_ESC_p_m0_t100_t250', [0x1B, 0x70, 0, 100, 250]],// 钱箱1, ON 200ms, OFF 500ms
    ['EPSON_ESC_p_m0_t120_t250', [0x1B, 0x70, 0, 120, 250]],// 钱箱1, ON 240ms, OFF 500ms (较长脉冲)
    ['EPSON_ESC_p_m0_t125_t125', [0x1B, 0x70, 0, 125, 125]],// 钱箱1, ON 250ms, OFF 250ms
    ['EPSON_ESC_p_m0_t125_t250_MAX_T1', [0x1B, 0x70, 0, 125, 250]],// 钱箱1, ON 250ms, OFF 500ms (Epson TM系列 t1最大值)
    ['EPSON_ESC_p_m0_t150_t250', [0x1B, 0x70, 0, 150, 250]],// 钱箱1, ON 300ms, OFF 500ms (更长脉冲)
    ['EPSON_ESC_p_m0_t200_t250', [0x1B, 0x70, 0, 200, 250]],// 钱箱1, ON 400ms, OFF 500ms (非常长脉冲)
    ['EPSON_ESC_p_m0_t250_t250', [0x1B, 0x70, 0, 250, 250]],// 钱箱1, ON 500ms, OFF 500ms (极长脉冲)

    // 使用 ASCII '0' (48) 作为 m (钱箱1) - 部分关键脉冲的ASCII版本
    ['EPSON_ESC_p_m48_t25_t250', [0x1B, 0x70, 48, 25, 250]], // 钱箱1 (m=ASCII '0'), ON 50ms, OFF 500ms
    ['EPSON_ESC_p_m48_t50_t100', [0x1B, 0x70, 48, 50, 100]], // 钱箱1 (m=ASCII '0'), ON 100ms, OFF 200ms
    ['EPSON_ESC_p_m48_t60_t120', [0x1B, 0x70, 48, 60, 120]], // 钱箱1 (m=ASCII '0'), ON 120ms, OFF 240ms
    ['EPSON_ESC_p_m48_t75_t150', [0x1B, 0x70, 48, 75, 150]], // 钱箱1 (m=ASCII '0'), ON 150ms, OFF 300ms
    ['EPSON_ESC_p_m48_t100_t250', [0x1B, 0x70, 48, 100, 250]],// 钱箱1 (m=ASCII '0'), ON 200ms, OFF 500ms
    ['EPSON_ESC_p_m48_t125_t250', [0x1B, 0x70, 48, 125, 250]],// 钱箱1 (m=ASCII '0'), ON 250ms, OFF 500ms

    // 钱箱2 (m=1 或 ASCII '1', 通常连接到打印机的 DK 端口的针脚 5 和 4) 的常见脉冲 - 对应钱箱1的脉冲组合
    ['EPSON_ESC_p_m1_t25_t250', [0x1B, 0x70, 1, 25, 250]], // 钱箱2, ON 50ms, OFF 500ms
    ['EPSON_ESC_p_m1_t50_t250', [0x1B, 0x70, 1, 50, 250]], // 钱箱2, ON 100ms, OFF 500ms
    ['EPSON_ESC_p_m1_t60_t250', [0x1B, 0x70, 1, 60, 250]], // 钱箱2, ON 120ms, OFF 500ms
    ['EPSON_ESC_p_m1_t75_t250', [0x1B, 0x70, 1, 75, 250]], // 钱箱2, ON 150ms, OFF 500ms
    ['EPSON_ESC_p_m1_t100_t250', [0x1B, 0x70, 1, 100, 250]],// 钱箱2, ON 200ms, OFF 500ms
    ['EPSON_ESC_p_m1_t125_t250', [0x1B, 0x70, 1, 125, 250]],// 钱箱2, ON 250ms, OFF 500ms
    ['EPSON_ESC_p_m1_t50_t100', [0x1B, 0x70, 1, 50, 100]], // 钱箱2, ON 100ms, OFF 200ms

    // 使用 ASCII '1' (49) 作为 m (钱箱2)
    ['EPSON_ESC_p_m49_t25_t250', [0x1B, 0x70, 49, 25, 250]], // 钱箱2 (m=ASCII '1')
    ['EPSON_ESC_p_m49_t50_t100', [0x1B, 0x70, 49, 50, 100]], // 钱箱2 (m=ASCII '1')
    ['EPSON_ESC_p_m49_t75_t150', [0x1B, 0x70, 49, 75, 150]], // 钱箱2 (m=ASCII '1'), ON 150ms, OFF 300ms
    ['EPSON_ESC_p_m49_t100_t250', [0x1B, 0x70, 49, 100, 250]],// 钱箱2 (m=ASCII '1'), ON 200ms, OFF 500ms
    ['EPSON_ESC_p_m49_t125_t250', [0x1B, 0x70, 49, 125, 250]],// 钱箱2 (m=ASCII '1'), ON 250ms, OFF 500ms

    // --- ESC/POS DLE EOT n (实时命令) ---
    // (Data Link Escape, End Of Transmission)
    // 适用于 Epson 及其他兼容打印机
    ['EPSON_DLE_EOT_1', [0x10, 0x04, 0x01]], // 打开钱箱1 (脉冲至针脚2)
    ['EPSON_DLE_EOT_2', [0x10, 0x04, 0x02]], // DLE EOT 2 (某些文档提及，可能对应不同脉冲或钱箱1)
    ['EPSON_DLE_EOT_3', [0x10, 0x04, 0x03]], // DLE EOT 3 (同上, 钱箱1)
    ['EPSON_DLE_EOT_4', [0x10, 0x04, 0x04]], // 打开钱箱2 (脉冲至针脚5) - 较少见

    // --- ESC/POS GS V m n (踢出钱箱脉冲) ---
    // 适用于 Epson (如 TM-U220, TM-T88), Bixolon 等
    // GS V m n (0x1D 0x56 m n)
    // m = 0 或 48 (ASCII '0') 对应钱箱1 (连接器针脚2)
    // m = 1 或 49 (ASCII '1') 对应钱箱2 (连接器针脚5)
    // m = 65 (ASCII 'A') 或 66 (ASCII 'B') 也是某些打印机（如Epson TM-U220）支持的m值，通常对应0和1
    // n = 脉冲ON时间 (单位: 100微秒, 即 0.1ms)
    // 例如: n=100 -> 10ms; n=500 -> 50ms; n=1000 -> 100ms; n=2000 -> 200ms
    ['EPSON_GS_V_m0_n50', [0x1D, 0x56, 0, 50]],     // 钱箱1, 5ms ON
    ['EPSON_GS_V_m0_n100', [0x1D, 0x56, 0, 100]],    // 钱箱1, 10ms ON
    ['EPSON_GS_V_m0_n150', [0x1D, 0x56, 0, 150]],    // 钱箱1, 15ms ON
    ['EPSON_GS_V_m0_n200', [0x1D, 0x56, 0, 200]],    // 钱箱1, 20ms ON
    ['EPSON_GS_V_m0_n250', [0x1D, 0x56, 0, 250]],    // 钱箱1, 25ms ON
    ['EPSON_GS_V_m0_n300', [0x1D, 0x56, 0, 300]],    // 钱箱1, 30ms ON
    ['EPSON_GS_V_m0_n400', [0x1D, 0x56, 0, 400]],    // 钱箱1, 40ms ON
    ['EPSON_GS_V_m0_n500_COMMON', [0x1D, 0x56, 0, 500]],    // 钱箱1, 50ms ON (常用)
    ['EPSON_GS_V_m48_n500', [0x1D, 0x56, 48, 500]],   // 钱箱1, 50ms ON (m=ASCII '0')
    ['EPSON_GS_V_m65_n500_TMU220', [0x1D, 0x56, 65, 500]],   // 钱箱1, 50ms ON (m=ASCII 'A', 适用于如 Epson TM-U220)
    ['EPSON_GS_V_m0_n600', [0x1D, 0x56, 0, 600]],    // 钱箱1, 60ms ON
    ['EPSON_GS_V_m0_n700', [0x1D, 0x56, 0, 700]],    // 钱箱1, 70ms ON
    ['EPSON_GS_V_m0_n800', [0x1D, 0x56, 0, 800]],    // 钱箱1, 80ms ON
    ['EPSON_GS_V_m0_n900', [0x1D, 0x56, 0, 900]],    // 钱箱1, 90ms ON
    ['EPSON_GS_V_m0_n1000_COMMON', [0x1D, 0x56, 0, 1000]],   // 钱箱1, 100ms ON (常用)
    ['EPSON_GS_V_m48_n1000', [0x1D, 0x56, 48, 1000]],  // 钱箱1, 100ms ON (m=ASCII '0')
    ['EPSON_GS_V_m65_n1000_TMU220', [0x1D, 0x56, 65, 1000]],  // 钱箱1, 100ms ON (m=ASCII 'A')
    ['EPSON_GS_V_m0_n1200', [0x1D, 0x56, 0, 1200]],   // 钱箱1, 120ms ON
    ['EPSON_GS_V_m0_n1500', [0x1D, 0x56, 0, 1500]],   // 钱箱1, 150ms ON
    ['EPSON_GS_V_m48_n1500', [0x1D, 0x56, 48, 1500]],  // 钱箱1, 150ms ON (m=ASCII '0')
    ['EPSON_GS_V_m65_n1500_TMU220', [0x1D, 0x56, 65, 1500]],  // 钱箱1, 150ms ON (m=ASCII 'A')
    ['EPSON_GS_V_m0_n2000', [0x1D, 0x56, 0, 2000]],   // 钱箱1, 200ms ON
    ['EPSON_GS_V_m0_n2500_ESC_p_MAX_T1', [0x1D, 0x56, 0, 2500]],   // 钱箱1, 250ms ON (对应ESC p t1=125)
    ['EPSON_GS_V_m0_n3000', [0x1D, 0x56, 0, 3000]],   // 钱箱1, 300ms ON

    ['EPSON_GS_V_m1_n50', [0x1D, 0x56, 1, 50]],     // 钱箱2, 5ms ON
    ['EPSON_GS_V_m1_n100', [0x1D, 0x56, 1, 100]],    // 钱箱2, 10ms ON
    ['EPSON_GS_V_m1_n500', [0x1D, 0x56, 1, 500]],    // 钱箱2, 50ms ON
    ['EPSON_GS_V_m49_n500', [0x1D, 0x56, 49, 500]],   // 钱箱2, 50ms ON (m=ASCII '1')
    ['EPSON_GS_V_m66_n500_TMU220', [0x1D, 0x56, 66, 500]],   // 钱箱2, 50ms ON (m=ASCII 'B', 适用于如 Epson TM-U220)
    ['EPSON_GS_V_m1_n1000', [0x1D, 0x56, 1, 1000]],   // 钱箱2, 100ms ON
    ['EPSON_GS_V_m49_n1000', [0x1D, 0x56, 49, 1000]],  // 钱箱2, 100ms ON (m=ASCII '1')
    ['EPSON_GS_V_m66_n1000_TMU220', [0x1D, 0x56, 66, 1000]],  // 钱箱2, 100ms ON (m=ASCII 'B')
    ['EPSON_GS_V_m1_n1500', [0x1D, 0x56, 1, 1500]],   // 钱箱2, 150ms ON
    ['EPSON_GS_V_m1_n2000', [0x1D, 0x56, 1, 2000]],   // 钱箱2, 200ms ON
    ['EPSON_GS_V_m1_n2500', [0x1D, 0x56, 1, 2500]],   // 钱箱2, 250ms ON
    ['EPSON_GS_V_m1_n3000', [0x1D, 0x56, 1, 3000]],   // 钱箱2, 300ms ON

    // --- ESC/POS BEL 命令变体 (有时用于钱箱) ---
    // 适用于 Epson 及其他兼容打印机
    ['EPSON_BEL_n1', [0x1B, 0x07, 0x01]],        // ESC BEL n=1 (钱箱1，短脉冲)
    ['EPSON_BEL_n2', [0x1B, 0x07, 0x02]],        // ESC BEL n=2 (钱箱1，稍长脉冲)
    ['EPSON_BEL_n3', [0x1B, 0x07, 0x03]],        // ESC BEL n=3 (钱箱1)
    ['EPSON_BEL_n4', [0x1B, 0x07, 0x04]],        // ESC BEL n=4 (钱箱1)
    ['EPSON_BEL_n5', [0x1B, 0x07, 0x05]],        // ESC BEL n=5 (钱箱1, 较长脉冲)
    ['EPSON_BEL_n6', [0x1B, 0x07, 0x06]],        // ESC BEL n=6 (钱箱1)
    ['EPSON_BEL_n7', [0x1B, 0x07, 0x07]],        // ESC BEL n=7 (钱箱1)
    ['EPSON_BEL_n8', [0x1B, 0x07, 0x08]],        // ESC BEL n=8 (钱箱1)

    // --- 通用 / 其他潜在命令 ---
    // 某些系统可能使用简单的字符序列
    ['GENERIC_SEQ_1', [0x10, 0x14, 0x01, 0x00, 0x01]], // 某些通用驱动中的示例 (钱箱1)
    ['GENERIC_ESC_i', [0x1B, 0x69]],                   // ESC i - 某些较旧或简单的钱箱 (钱箱1)
    // 初始化打印机 (ESC @) 后再发送开钱箱命令，有时能解决一些状态问题
    ['INIT_EPSON_ESC_p_m0_t50_t500', [0x1B, 0x40, 0x1B, 0x70, 0x00, 0x32, 0xFA]], // 初始化 + Epson命令 (钱箱1, 0x32=50ms, 0xFA=500ms)
    ['INIT_EPSON_GS_V_m0_n500', [0x1B, 0x40, 0x1D, 0x56, 0, 500]],          // 初始化 + GS V 命令 (钱箱1, 50ms)
    ['INIT_EPSON_GS_V_m0_n1000', [0x1B, 0x40, 0x1D, 0x56, 0, 1000]],         // 初始化 + GS V 命令 (钱箱1, 100ms)

    // --- Commands for specific manufacturers if known to differ significantly ---
    // (These are often still ESC/POS compatible but might have preferred sequences)

    // Bixolon (通常与ESC/POS兼容, SRP系列)
    ['BIXOLON_ESC_p_m0_t25_t250', [0x1B, 0x70, 0x00, 0x19, 0xFA]], // Bixolon 典型: 钱箱1 (m=0), t1=25 (50ms), t2=250 (500ms)
    ['BIXOLON_ESC_p_m1_t25_t250', [0x1B, 0x70, 0x01, 0x19, 0xFA]], // Bixolon 典型: 钱箱2 (m=1), t1=25 (50ms), t2=250 (500ms)

    // Citizen (通常与ESC/POS兼容, CT-S系列)
    // Citizen 通常使用标准ESC/POS，但脉冲时间可能很关键。
    // 现有的Epson命令应能覆盖大多数Citizen打印机。
    // Citizen <ESC> k n (n=pulse width in 10ms units, for drawer 1)
    ['CITIZEN_ESC_k_n5', [0x1B, 0x6B, 0x05]], // Citizen ESC k 5 (钱箱1, 50ms pulse)
    ['CITIZEN_ESC_k_n10', [0x1B, 0x6B, 0x0A]], // Citizen ESC k 10 (钱箱1, 100ms pulse)
    ['CITIZEN_ESC_k_n15', [0x1B, 0x6B, 0x0F]], // Citizen ESC k 15 (钱箱1, 150ms pulse)
    ['CITIZEN_ESC_k_n20', [0x1B, 0x6B, 0x14]], // Citizen ESC k 20 (钱箱1, 200ms pulse)
    ['CITIZEN_ESC_k_n25', [0x1B, 0x6B, 0x19]], // Citizen ESC k 25 (钱箱1, 250ms pulse)
]);

module.exports = {
    commandsToTry
};