export interface LiveEvent {
    id: string;
    title: string;
    sport: string;
    category: string;
    competition: string;
    hls: string;
    jenis: string;
    header_iptv: string;
    header_license: string;
    url_license: string;
    thumbnail: string;
    is_live: 't' | 'f';
    t_stamp: string;
    s_stamp: string;
}
